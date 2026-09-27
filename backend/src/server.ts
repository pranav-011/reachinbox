import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { testDbConnection, prisma } from './db/prisma.js';
import { getRedisConnection } from './db/redis.js';
import { initElasticsearch } from './services/elasticsearchService.js';
import { getEmailQueue, addEmailJob } from './queues/emailQueue.js';
import { initEmailWorker, stopEmailWorker } from './queues/emailWorker.js';
import { setupBullBoard } from './bullboard/index.js';

import emailRoutes from './routes/emailRoutes.js';
import authRoutes from './routes/authRoutes.js';
import slackRoutes from './routes/slackRoutes.js';

const app = express();

// Middleware
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-scheduler-backend',
  });
});

// BullMQ Live Dashboard UI
try {
  const bullBoardRouter = setupBullBoard();
  app.use('/admin/queues', bullBoardRouter);
  console.log('📊 BullMQ Dashboard mounted at /admin/queues');
} catch (err: any) {
  console.warn('⚠️ BullMQ Dashboard could not be mounted immediately:', err.message);
}

// API Routes
app.use('/api/emails', emailRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/slack', slackRoutes);

// Server Restart Job Reconciliation & Idempotent Persistence Check
async function reconcilePendingJobsOnStartup() {
  try {
    console.log('🔄 Checking for pending scheduled emails to reconcile after startup...');
    const queue = getEmailQueue();

    // Query DB for emails that are SCHEDULED or RATE_LIMITED
    const pendingEmails = await prisma.scheduledEmail.findMany({
      where: {
        status: { in: ['SCHEDULED', 'RATE_LIMITED'] },
      },
    });

    console.log(`🔎 Found ${pendingEmails.length} pending emails in database.`);

    for (const email of pendingEmails) {
      const jobId = email.jobId || `email-job-${email.id}`;
      const existingJob = await queue.getJob(jobId);

      // If BullMQ already has this delayed job scheduled in Redis, leave it alone (preserve state)
      if (existingJob) {
        const state = await existingJob.getState();
        console.log(`ℹ️ Job [${jobId}] for ${email.recipient} is active in queue with state '${state}'. Preserving.`);
        continue;
      }

      // If job is missing from Redis (e.g. Redis restart or flush), re-enqueue it idempotently
      const scheduledMs = new Date(email.scheduledTime).getTime();
      const delayMs = Math.max(0, scheduledMs - Date.now());

      console.log(
        `♻️ Re-enqueueing recovered job [${jobId}] for ${email.recipient} (Delay: ${delayMs}ms, Scheduled: ${email.scheduledTime.toISOString()})`
      );

      const job = await addEmailJob(
        {
          emailId: email.id,
          recipient: email.recipient,
          subject: email.subject,
          body: email.body,
          senderEmail: email.senderEmail,
          scheduledTime: email.scheduledTime.toISOString(),
          delaySeconds: email.delaySeconds,
          hourlyLimit: email.hourlyLimit,
          userId: email.userId,
          rescheduledCount: email.rescheduledCount,
        },
        delayMs,
        jobId
      );

      if (email.jobId !== job.id) {
        await prisma.scheduledEmail.update({
          where: { id: email.id },
          data: { jobId: job.id?.toString() },
        });
      }
    }
  } catch (err: any) {
    console.warn('⚠️ Job reconciliation encountered an error:', err.message);
  }
}

// Start Server
async function startServer() {
  console.log('🚀 Starting ReachInbox Email Scheduler Service...');

  // 1. Verify DB
  await testDbConnection();

  // 2. Verify Redis
  try {
    const redis = getRedisConnection();
    await redis.ping();
  } catch (redisErr: any) {
    console.warn('⚠️ Redis ping failed. Ensure Redis is running on port 6379:', redisErr.message);
  }

  // 3. Initialize Elasticsearch
  await initElasticsearch();

  // 4. Initialize Queue and Worker
  getEmailQueue();
  initEmailWorker();

  // 5. Reconcile pending jobs
  await reconcilePendingJobsOnStartup();

  // 6. Listen
  const server = app.listen(config.port, () => {
    console.log(`
=============================================================
🌟 ReachInbox Scheduler Backend Running Successfully!
📡 HTTP API:        http://localhost:${config.port}
📊 BullMQ Board:    http://localhost:${config.port}/admin/queues
🩺 Health Check:    http://localhost:${config.port}/health
=============================================================
    `);
  });

  // Graceful Shutdown
  const shutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Shutting down gracefully...`);
    await stopEmailWorker();
    server.close(async () => {
      await prisma.$disconnect();
      console.log('👋 Process terminated gracefully.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  console.error('💥 Fatal error starting server:', err);
  process.exit(1);
});

export default app;
