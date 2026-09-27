import { Worker, Job } from 'bullmq';
import { getRedisConnection } from '../db/redis.js';
import { EMAIL_QUEUE_NAME, EmailJobData, addEmailJob } from './emailQueue.js';
import { config } from '../config/index.js';
import { sendEmail } from '../services/emailService.js';
import { checkAndIncrementRateLimit } from './rateLimiter.js';
import { prisma } from '../db/prisma.js';
import { indexEmail } from '../services/elasticsearchService.js';

let workerInstance: Worker<EmailJobData> | null = null;

// Helper to enforce minimum delay between sends
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function enforceSenderThrottle(senderEmail: string, delaySeconds: number): Promise<void> {
  const redis = getRedisConnection();
  const minDelayMs = Math.max(delaySeconds, config.scheduler.defaultMinDelaySeconds) * 1000;
  const lastSendKey = `sender_last_send_timestamp:${senderEmail}`;

  const lastSendTimestampStr = await redis.get(lastSendKey);
  const now = Date.now();

  if (lastSendTimestampStr) {
    const lastSendTime = parseInt(lastSendTimestampStr, 10);
    const timeElapsed = now - lastSendTime;

    if (timeElapsed < minDelayMs) {
      const waitTime = minDelayMs - timeElapsed;
      console.log(`⏱️ Throttle enforced for ${senderEmail}: waiting ${waitTime}ms before send...`);
      await delay(waitTime);
    }
  }

  // Update last send timestamp
  await redis.set(lastSendKey, Date.now().toString(), 'EX', 3600);
}

export function initEmailWorker(): Worker<EmailJobData> {
  if (workerInstance) {
    return workerInstance;
  }

  const redis = getRedisConnection();

  workerInstance = new Worker<EmailJobData>(
    EMAIL_QUEUE_NAME,
    async (job: Job<EmailJobData>) => {
      const {
        emailId,
        recipient,
        subject,
        body,
        senderEmail,
        delaySeconds,
        hourlyLimit,
        userId,
        rescheduledCount = 0,
      } = job.data;

      console.log(`\n📨 [Worker] Processing job [${job.id}] -> Send to ${recipient} from ${senderEmail}`);

      // 1. Idempotency Check in DB
      let emailRecord = null;
      try {
        emailRecord = await prisma.scheduledEmail.findUnique({
          where: { id: emailId },
        });
      } catch (err: any) {
        console.warn('⚠️ Could not query DB for idempotency check:', err.message);
      }

      if (emailRecord) {
        // Prevent duplicate sending if already sent
        if (emailRecord.status === 'SENT') {
          console.log(`⚠️ Idempotency check: Email [${emailId}] is already SENT. Skipping.`);
          return { status: 'already_sent', emailId };
        }

        // Check if user cancelled this email
        if (emailRecord.status === 'CANCELLED') {
          console.log(`🚫 Email [${emailId}] was CANCELLED by user. Aborting job.`);
          return { status: 'cancelled', emailId };
        }
      }

      // 2. Distributed Hourly Rate Limit Check
      const rateLimitResult = await checkAndIncrementRateLimit({
        senderEmail,
        customLimit: hourlyLimit,
        userId,
        rescheduledCount,
      });

      if (!rateLimitResult.allowed) {
        const rescheduleDelayMs = rateLimitResult.delayMs || 30000;
        const nextWindow = rateLimitResult.nextWindowTime || 'next hour window';

        console.log(
          `⏳ Rate limit reached for ${senderEmail}! Rescheduling email [${emailId}] to ${nextWindow} (+${rescheduleDelayMs}ms).`
        );

        // Update DB status to RATE_LIMITED / RESCHEDULED
        try {
          const updated = await prisma.scheduledEmail.update({
            where: { id: emailId },
            data: {
              status: 'RATE_LIMITED',
              rescheduledCount: rescheduledCount + 1,
              scheduledTime: new Date(Date.now() + rescheduleDelayMs),
            },
          });

          // Update Elasticsearch index
          await indexEmail({
            id: updated.id,
            userId: updated.userId,
            recipient: updated.recipient,
            subject: updated.subject,
            body: updated.body,
            senderEmail: updated.senderEmail,
            status: updated.status,
            scheduledTime: updated.scheduledTime,
            createdAt: updated.createdAt,
          });
        } catch (dbErr: any) {
          console.warn('⚠️ DB update failed during rate-limit reschedule:', dbErr.message);
        }

        // Reschedule job into next hour window (DO NOT DROP)
        const nextJobId = `email-job-${emailId}-r${rescheduledCount + 1}`;
        await addEmailJob(
          {
            ...job.data,
            rescheduledCount: rescheduledCount + 1,
            scheduledTime: new Date(Date.now() + rescheduleDelayMs).toISOString(),
          },
          rescheduleDelayMs,
          nextJobId
        );

        return {
          status: 'rescheduled_due_to_rate_limit',
          rescheduledTo: nextWindow,
          delayMs: rescheduleDelayMs,
        };
      }

      // 3. Minimum Delay Between Each Email Send (Provider throttling)
      await enforceSenderThrottle(senderEmail, delaySeconds);

      // 4. Mark status as PROCESSING in DB
      try {
        await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'PROCESSING',
            attempts: { increment: 1 },
            lastAttemptAt: new Date(),
          },
        });
      } catch (err: any) {
        console.warn('⚠️ Could not update email status to PROCESSING:', err.message);
      }

      // 5. Send Email via Ethereal SMTP
      const sendResult = await sendEmail({
        from: senderEmail,
        to: recipient,
        subject,
        body,
      });

      if (!sendResult.success) {
        console.error(`❌ Failed to send email to ${recipient}: ${sendResult.error}`);

        // Update DB as FAILED if attempts exhausted
        if (job.attemptsMade + 1 >= (job.opts.attempts || 3)) {
          try {
            const failedEmail = await prisma.scheduledEmail.update({
              where: { id: emailId },
              data: {
                status: 'FAILED',
                failedAt: new Date(),
                errorMessage: sendResult.error,
              },
            });

            await indexEmail({
              id: failedEmail.id,
              userId: failedEmail.userId,
              recipient: failedEmail.recipient,
              subject: failedEmail.subject,
              body: failedEmail.body,
              senderEmail: failedEmail.senderEmail,
              status: failedEmail.status,
              scheduledTime: failedEmail.scheduledTime,
              createdAt: failedEmail.createdAt,
            });
          } catch (dbErr: any) {
            console.warn('⚠️ DB update failed for failed email:', dbErr.message);
          }
        }

        throw new Error(sendResult.error || 'SMTP delivery failed');
      }

      // 6. Success: Update DB and Elasticsearch Index
      try {
        const sentRecord = await prisma.scheduledEmail.update({
          where: { id: emailId },
          data: {
            status: 'SENT',
            sentAt: new Date(),
            etherealPreviewUrl: sendResult.etherealPreviewUrl,
            messageId: sendResult.messageId,
          },
        });

        await indexEmail({
          id: sentRecord.id,
          userId: sentRecord.userId,
          recipient: sentRecord.recipient,
          subject: sentRecord.subject,
          body: sentRecord.body,
          senderEmail: sentRecord.senderEmail,
          status: 'SENT',
          scheduledTime: sentRecord.scheduledTime,
          sentAt: sentRecord.sentAt,
          createdAt: sentRecord.createdAt,
          etherealPreviewUrl: sentRecord.etherealPreviewUrl,
        });

        console.log(`🎉 Email [${emailId}] marked as SENT in DB and indexed in Elasticsearch.`);
      } catch (dbErr: any) {
        console.warn('⚠️ DB update for SENT status encountered an issue:', dbErr.message);
      }

      return {
        status: 'sent',
        messageId: sendResult.messageId,
        etherealPreviewUrl: sendResult.etherealPreviewUrl,
      };
    },
    {
      connection: redis,
      concurrency: config.scheduler.workerConcurrency,
    }
  );

  workerInstance.on('completed', (job: Job) => {
    console.log(`✅ [Worker] Job [${job.id}] completed successfully.`);
  });

  workerInstance.on('failed', (job: Job | undefined, err: Error) => {
    console.error(`💥 [Worker] Job [${job?.id}] failed: ${err.message}`);
  });

  console.log(
    `⚙️ BullMQ Worker initialized with Concurrency=${config.scheduler.workerConcurrency}, MinDelay=${config.scheduler.defaultMinDelaySeconds}s`
  );

  return workerInstance;
}

export async function stopEmailWorker(): Promise<void> {
  if (workerInstance) {
    await workerInstance.close();
    workerInstance = null;
    console.log('🛑 BullMQ Worker stopped.');
  }
}
