import { Queue, QueueEvents } from 'bullmq';
import { getRedisConnection } from '../db/redis.js';

export const EMAIL_QUEUE_NAME = 'reachinbox-email-queue';

export interface EmailJobData {
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  scheduledTime: string;
  delaySeconds: number;
  hourlyLimit: number;
  userId?: string | null;
  rescheduledCount?: number;
}

let emailQueue: Queue<EmailJobData> | null = null;
let queueEvents: QueueEvents | null = null;

export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    const redis = getRedisConnection();
    emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
      connection: redis,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          count: 1000,
        },
        removeOnFail: {
          count: 5000,
        },
      },
    });

    console.log(`🚀 BullMQ Queue '${EMAIL_QUEUE_NAME}' initialized.`);
  }

  return emailQueue;
}

export function getQueueEvents(): QueueEvents {
  if (!queueEvents) {
    const redis = getRedisConnection();
    queueEvents = new QueueEvents(EMAIL_QUEUE_NAME, { connection: redis });
  }
  return queueEvents;
}

export async function addEmailJob(
  data: EmailJobData,
  delayMs: number,
  customJobId?: string
) {
  const queue = getEmailQueue();
  const calculatedDelay = Math.max(0, delayMs);
  const jobId = customJobId || `email-job-${data.emailId}`;

  const job = await queue.add('send-email', data, {
    delay: calculatedDelay,
    jobId,
  });

  console.log(
    `📋 Enqueued BullMQ job [${job.id}] for ${data.recipient} with delay ${calculatedDelay}ms (Scheduled for ${new Date(
      Date.now() + calculatedDelay
    ).toISOString()})`
  );

  return job;
}

export async function cancelEmailJob(jobId: string): Promise<boolean> {
  const queue = getEmailQueue();
  const job = await queue.getJob(jobId);
  if (job) {
    await job.remove();
    console.log(`🗑️ Removed BullMQ job [${jobId}]`);
    return true;
  }
  return false;
}

export async function getQueueMetrics() {
  const queue = getEmailQueue();
  const [waiting, active, delayed, completed, failed, isPaused] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getDelayedCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
    queue.isPaused(),
  ]);

  return {
    waiting,
    active,
    delayed,
    completed,
    failed,
    isPaused,
    total: waiting + active + delayed + completed + failed,
  };
}
