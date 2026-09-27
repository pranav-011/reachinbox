import { getRedisConnection } from '../db/redis.js';
import { config } from '../config/index.js';
import { sendRateLimitSlackAlert } from '../services/slackService.js';
import { prisma } from '../db/prisma.js';

export function getCurrentHourWindow(): string {
  const now = new Date();
  return now.toISOString().slice(0, 13); // format: "2026-09-27T10"
}

export function getMillisecondsUntilNextHour(): number {
  const now = new Date();
  const nextHour = new Date(now);
  nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
  // Add 2-second buffer to ensure the execution arrives inside the new window
  return Math.max(5000, nextHour.getTime() - now.getTime() + 2000);
}

export interface RateLimitCheckResult {
  allowed: boolean;
  delayMs?: number;
  currentCount: number;
  limit: number;
  hourWindow: string;
  nextWindowTime?: string;
  reason?: string;
}

export async function checkAndIncrementRateLimit(params: {
  senderEmail: string;
  customLimit?: number;
  userId?: string | null;
  rescheduledCount?: number;
}): Promise<RateLimitCheckResult> {
  const redis = getRedisConnection();
  const { senderEmail, customLimit, userId, rescheduledCount = 0 } = params;

  const senderLimit = customLimit && customLimit > 0
    ? customLimit
    : config.scheduler.maxEmailsPerHourPerSender;
  const globalLimit = config.scheduler.globalMaxEmailsPerHour;

  const hourWindow = getCurrentHourWindow();
  const senderKey = `email_rate_limit:sender:${senderEmail}:${hourWindow}`;
  const globalKey = `email_rate_limit:global:${hourWindow}`;

  // Read current counts
  const [senderCountStr, globalCountStr] = await redis.mget(senderKey, globalKey);
  const currentSenderCount = parseInt(senderCountStr || '0', 10);
  const currentGlobalCount = parseInt(globalCountStr || '0', 10);

  // Check if sender limit is reached
  if (currentSenderCount >= senderLimit) {
    const delayMs = getMillisecondsUntilNextHour();
    const nextWindow = new Date(Date.now() + delayMs).toLocaleTimeString();

    // Trigger Slack Alert only once per sender per hour window
    const slackNotifiedKey = `slack_notified:${senderEmail}:${hourWindow}`;
    const acquiredNotificationLock = await redis.set(slackNotifiedKey, '1', 'EX', 7200, 'NX');

    if (acquiredNotificationLock) {
      console.log(`🚨 Hourly rate limit hit for ${senderEmail} (${currentSenderCount}/${senderLimit}). Notifying Slack...`);
      // Record incident in DB
      try {
        await prisma.rateLimitIncident.create({
          data: {
            senderEmail,
            hourWindow,
            count: currentSenderCount,
            limit: senderLimit,
            slackSent: true,
          },
        });
      } catch (dbErr: any) {
        console.warn('⚠️ Could not log rate limit incident to DB:', dbErr.message);
      }

      // Live Slack call
      await sendRateLimitSlackAlert({
        senderEmail,
        hourWindow,
        count: currentSenderCount,
        limit: senderLimit,
        userId,
        rescheduledCount: rescheduledCount + 1,
        nextWindowTime: nextWindow,
      });
    }

    return {
      allowed: false,
      delayMs,
      currentCount: currentSenderCount,
      limit: senderLimit,
      hourWindow,
      nextWindowTime: nextWindow,
      reason: `Sender ${senderEmail} reached limit of ${senderLimit} emails/hour`,
    };
  }

  // Check if global limit is reached
  if (currentGlobalCount >= globalLimit) {
    const delayMs = getMillisecondsUntilNextHour();
    const nextWindow = new Date(Date.now() + delayMs).toLocaleTimeString();

    return {
      allowed: false,
      delayMs,
      currentCount: currentGlobalCount,
      limit: globalLimit,
      hourWindow,
      nextWindowTime: nextWindow,
      reason: `Global limit of ${globalLimit} emails/hour reached`,
    };
  }

  // Atomically increment both counters
  const pipeline = redis.pipeline();
  pipeline.incr(senderKey);
  pipeline.expire(senderKey, 7200); // 2 hours TTL
  pipeline.incr(globalKey);
  pipeline.expire(globalKey, 7200);

  const results = await pipeline.exec();
  const newSenderCount = results && results[0] && results[0][1] ? Number(results[0][1]) : currentSenderCount + 1;

  return {
    allowed: true,
    currentCount: newSenderCount,
    limit: senderLimit,
    hourWindow,
  };
}

export async function getRateLimitStatus(senderEmail: string, customLimit?: number) {
  const redis = getRedisConnection();
  const hourWindow = getCurrentHourWindow();
  const senderKey = `email_rate_limit:sender:${senderEmail}:${hourWindow}`;
  const globalKey = `email_rate_limit:global:${hourWindow}`;

  const [senderCountStr, globalCountStr] = await redis.mget(senderKey, globalKey);
  const senderCount = parseInt(senderCountStr || '0', 10);
  const globalCount = parseInt(globalCountStr || '0', 10);
  const senderLimit = customLimit || config.scheduler.maxEmailsPerHourPerSender;
  const globalLimit = config.scheduler.globalMaxEmailsPerHour;

  return {
    hourWindow,
    sender: {
      email: senderEmail,
      count: senderCount,
      limit: senderLimit,
      remaining: Math.max(0, senderLimit - senderCount),
      isLimited: senderCount >= senderLimit,
    },
    global: {
      count: globalCount,
      limit: globalLimit,
      remaining: Math.max(0, globalLimit - globalCount),
      isLimited: globalCount >= globalLimit,
    },
    msUntilNextHour: getMillisecondsUntilNextHour(),
  };
}
