import { Response } from 'express';
import { z } from 'zod';
import { prisma } from '../db/prisma.js';
import { addEmailJob, cancelEmailJob, getQueueMetrics } from '../queues/emailQueue.js';
import { indexEmail, searchEmailsInES, isElasticsearchReady } from '../services/elasticsearchService.js';
import { getRateLimitStatus } from '../queues/rateLimiter.js';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import { config } from '../config/index.js';

const ScheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  recipients: z.array(z.string().email('Invalid email')).min(1, 'At least one recipient is required'),
  senderEmail: z.string().email().optional().default('outreach@reachinbox.ai'),
  startTime: z.string().optional(),
  delayBetweenEmails: z.number().min(0).optional().default(config.scheduler.defaultMinDelaySeconds),
  hourlyLimit: z.number().min(1).optional().default(config.scheduler.maxEmailsPerHourPerSender),
});

export async function scheduleEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const parseResult = ScheduleEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({ error: 'Validation failed', details: parseResult.error.format() });
    }

    const {
      subject,
      body,
      recipients,
      senderEmail,
      startTime,
      delayBetweenEmails,
      hourlyLimit,
    } = parseResult.data;

    const userId = req.user?.id || null;
    const now = Date.now();
    const parsedStartTime = startTime ? new Date(startTime).getTime() : now;
    const baseDelayMs = Math.max(0, parsedStartTime - now);
    const spacingDelayMs = delayBetweenEmails * 1000;

    console.log(
      `📅 Scheduling ${recipients.length} emails from ${senderEmail} starting at ${new Date(
        parsedStartTime
      ).toISOString()} with ${delayBetweenEmails}s delay and limit ${hourlyLimit}/hr`
    );

    const createdRecords = [];

    // Schedule each recipient with calculated offset delay
    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      const jobDelayMs = baseDelayMs + (i * spacingDelayMs);
      const scheduledTime = new Date(now + jobDelayMs);

      // 1. Create record in Relational Database
      const emailRecord = await prisma.scheduledEmail.create({
        data: {
          userId,
          recipient,
          subject,
          body,
          senderEmail,
          scheduledTime,
          delaySeconds: delayBetweenEmails,
          hourlyLimit,
          status: 'SCHEDULED',
        },
      });

      // 2. Schedule BullMQ delayed job
      const job = await addEmailJob(
        {
          emailId: emailRecord.id,
          recipient,
          subject,
          body,
          senderEmail,
          scheduledTime: scheduledTime.toISOString(),
          delaySeconds: delayBetweenEmails,
          hourlyLimit,
          userId,
        },
        jobDelayMs
      );

      // 3. Update record with BullMQ Job ID
      const updatedRecord = await prisma.scheduledEmail.update({
        where: { id: emailRecord.id },
        data: { jobId: job.id?.toString() },
      });

      // 4. Index in Elasticsearch for instant searchability
      await indexEmail({
        id: updatedRecord.id,
        userId: updatedRecord.userId,
        recipient: updatedRecord.recipient,
        subject: updatedRecord.subject,
        body: updatedRecord.body,
        senderEmail: updatedRecord.senderEmail,
        status: updatedRecord.status,
        scheduledTime: updatedRecord.scheduledTime,
        createdAt: updatedRecord.createdAt,
      });

      createdRecords.push(updatedRecord);
    }

    return res.status(201).json({
      success: true,
      message: `Successfully scheduled ${createdRecords.length} emails`,
      count: createdRecords.length,
      emails: createdRecords,
    });
  } catch (error: any) {
    console.error('❌ Error scheduling emails:', error);
    return res.status(500).json({ error: error.message || 'Internal server error while scheduling emails' });
  }
}

export async function getScheduledEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();

    const where: any = {
      status: {
        in: ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'],
      },
    };

    if (req.user?.id) {
      where.userId = req.user.id;
    }

    if (search) {
      where.OR = [
        { recipient: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { senderEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { scheduledTime: 'asc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    return res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('❌ Error getting scheduled emails:', error);
    return res.status(500).json({ error: 'Failed to retrieve scheduled emails' });
  }
}

export async function getSentEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const skip = (page - 1) * limit;
    const search = (req.query.search as string || '').trim();
    const statusFilter = req.query.status as string;

    const where: any = {
      status: statusFilter ? statusFilter : { in: ['SENT', 'FAILED'] },
    };

    if (req.user?.id) {
      where.userId = req.user.id;
    }

    if (search) {
      where.OR = [
        { recipient: { contains: search, mode: 'insensitive' } },
        { subject: { contains: search, mode: 'insensitive' } },
        { senderEmail: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    return res.json({
      emails,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('❌ Error getting sent emails:', error);
    return res.status(500).json({ error: 'Failed to retrieve sent emails' });
  }
}

export async function searchEmails(req: AuthenticatedRequest, res: Response) {
  try {
    const query = (req.query.q as string || '').trim();
    const status = req.query.status as string;
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = parseInt(req.query.limit as string || '50', 10);
    const from = (page - 1) * limit;

    if (!query) {
      return res.json({ emails: [], total: 0, engine: 'empty' });
    }

    // Try searching with Elasticsearch first
    if (isElasticsearchReady()) {
      const esResult = await searchEmailsInES({
        query,
        status,
        userId: req.user?.id,
        from,
        size: limit,
      });

      if (esResult.ids.length > 0) {
        // Fetch full DB records to ensure complete data
        const emails = await prisma.scheduledEmail.findMany({
          where: { id: { in: esResult.ids } },
        });

        // Retain ES sort order
        const idMap = new Map(emails.map((e) => [e.id, e]));
        const sortedEmails = esResult.ids
          .map((id) => idMap.get(id))
          .filter(Boolean);

        return res.json({
          emails: sortedEmails,
          total: esResult.total,
          engine: 'elasticsearch',
          pagination: {
            page,
            limit,
            total: esResult.total,
            totalPages: Math.ceil(esResult.total / limit),
          },
        });
      }
    }

    // Fallback: Database full search
    const where: any = {
      OR: [
        { recipient: { contains: query, mode: 'insensitive' } },
        { subject: { contains: query, mode: 'insensitive' } },
        { body: { contains: query, mode: 'insensitive' } },
        { senderEmail: { contains: query, mode: 'insensitive' } },
      ],
    };

    if (status) {
      where.status = status;
    }
    if (req.user?.id) {
      where.userId = req.user.id;
    }

    const [emails, total] = await Promise.all([
      prisma.scheduledEmail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: from,
        take: limit,
      }),
      prisma.scheduledEmail.count({ where }),
    ]);

    return res.json({
      emails,
      total,
      engine: 'database-fallback',
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('❌ Error searching emails:', error);
    return res.status(500).json({ error: 'Search failed' });
  }
}

export async function cancelEmail(req: AuthenticatedRequest, res: Response) {
  try {
    const id = req.params.id as string;

    const email = await prisma.scheduledEmail.findUnique({
      where: { id },
    });

    if (!email) {
      return res.status(404).json({ error: 'Email record not found' });
    }

    if (email.status === 'SENT') {
      return res.status(400).json({ error: 'Cannot cancel an email that is already sent' });
    }

    // Remove from BullMQ queue if jobId is present
    if (email.jobId) {
      await cancelEmailJob(email.jobId);
    }

    const updated = await prisma.scheduledEmail.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Update Elasticsearch
    await indexEmail({
      id: updated.id,
      userId: updated.userId,
      recipient: updated.recipient,
      subject: updated.subject,
      body: updated.body,
      senderEmail: updated.senderEmail,
      status: 'CANCELLED',
      scheduledTime: updated.scheduledTime,
      createdAt: updated.createdAt,
    });

    return res.json({ success: true, message: 'Email cancelled successfully', email: updated });
  } catch (error: any) {
    console.error('❌ Error cancelling email:', error);
    return res.status(500).json({ error: 'Failed to cancel email' });
  }
}

export async function getDashboardStats(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    const baseWhere = userId ? { userId } : {};

    const [
      totalCount,
      scheduledCount,
      sentCount,
      failedCount,
      rateLimitedCount,
      queueMetrics,
      rateLimitInfo,
    ] = await Promise.all([
      prisma.scheduledEmail.count({ where: baseWhere }),
      prisma.scheduledEmail.count({ where: { ...baseWhere, status: { in: ['SCHEDULED', 'PROCESSING'] } } }),
      prisma.scheduledEmail.count({ where: { ...baseWhere, status: 'SENT' } }),
      prisma.scheduledEmail.count({ where: { ...baseWhere, status: 'FAILED' } }),
      prisma.scheduledEmail.count({ where: { ...baseWhere, status: 'RATE_LIMITED' } }),
      getQueueMetrics(),
      getRateLimitStatus('outreach@reachinbox.ai'),
    ]);

    return res.json({
      stats: {
        total: totalCount,
        scheduled: scheduledCount,
        sent: sentCount,
        failed: failedCount,
        rateLimited: rateLimitedCount,
      },
      queue: queueMetrics,
      rateLimit: rateLimitInfo,
      elasticsearchConnected: isElasticsearchReady(),
    });
  } catch (error: any) {
    console.error('❌ Error getting dashboard stats:', error);
    return res.status(500).json({ error: 'Failed to retrieve stats' });
  }
}
