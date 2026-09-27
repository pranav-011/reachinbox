import { WebClient } from '@slack/web-api';
import axios from 'axios';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';

export function getSlackOAuthUrl(userId: string): string {
  if (!config.slack.clientId) {
    return '';
  }

  const scopes = [
    'chat:write',
    'incoming-webhook',
  ].join(',');

  const params = new URLSearchParams({
    client_id: config.slack.clientId,
    scope: scopes,
    redirect_uri: config.slack.redirectUri,
    state: userId,
  });

  return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
}

export async function exchangeSlackCode(code: string, userId: string): Promise<any> {
  const response = await axios.post(
    'https://slack.com/api/oauth.v2.access',
    new URLSearchParams({
      client_id: config.slack.clientId,
      client_secret: config.slack.clientSecret,
      code,
      redirect_uri: config.slack.redirectUri,
    }),
    {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  const data = response.data;
  if (!data.ok) {
    throw new Error(`Slack OAuth error: ${data.error || 'Failed to exchange authorization code'}`);
  }

  const targetUserId = await resolveValidUserId(userId);

  const integration = await prisma.slackIntegration.upsert({
    where: { userId: targetUserId },
    update: {
      teamId: data.team?.id,
      teamName: data.team?.name,
      channelId: data.incoming_webhook?.channel_id,
      channelName: data.incoming_webhook?.channel,
      accessToken: data.access_token,
      webhookUrl: data.incoming_webhook?.url,
      botUserId: data.bot_user_id,
      isActive: true,
    },
    create: {
      userId: targetUserId,
      teamId: data.team?.id,
      teamName: data.team?.name,
      channelId: data.incoming_webhook?.channel_id,
      channelName: data.incoming_webhook?.channel,
      accessToken: data.access_token,
      webhookUrl: data.incoming_webhook?.url,
      botUserId: data.bot_user_id,
      isActive: true,
    },
  });

  return integration;
}

async function resolveValidUserId(userId?: string): Promise<string> {
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user) return user.id;
  }
  const firstUser = await prisma.user.findFirst();
  if (firstUser) return firstUser.id;

  const created = await prisma.user.create({
    data: {
      email: 'admin@reachinbox.ai',
      name: 'ReachInbox Admin',
    },
  });
  return created.id;
}

export async function saveManualWebhook(userId: string, webhookUrl: string, channelName?: string): Promise<any> {
  const targetUserId = await resolveValidUserId(userId);
  return await prisma.slackIntegration.upsert({
    where: { userId: targetUserId },
    update: {
      webhookUrl,
      channelName: channelName || 'custom-webhook',
      isActive: true,
    },
    create: {
      userId: targetUserId,
      webhookUrl,
      channelName: channelName || 'custom-webhook',
      isActive: true,
    },
  });
}

export async function disconnectSlack(userId: string): Promise<void> {
  await prisma.slackIntegration.updateMany({
    where: { userId },
    data: { isActive: false, accessToken: null, webhookUrl: null },
  });
}

export interface RateLimitAlertData {
  senderEmail: string;
  hourWindow: string;
  count: number;
  limit: number;
  userId?: string | null;
  rescheduledCount?: number;
  nextWindowTime?: string;
}

export async function sendRateLimitSlackAlert(data: RateLimitAlertData): Promise<boolean> {
  const { senderEmail, hourWindow, count, limit, userId, rescheduledCount, nextWindowTime } = data;

  try {
    let integration = null;
    if (userId) {
      integration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });
    }

    if (!integration || !integration.isActive) {
      // Check if there is any active integration or default webhook
      integration = await prisma.slackIntegration.findFirst({
        where: { isActive: true },
      });
    }

    const webhookUrl = integration?.webhookUrl || config.slack.defaultWebhookUrl;
    const accessToken = integration?.accessToken;
    const channelId = integration?.channelId;

    if (!webhookUrl && !accessToken) {
      console.log(`ℹ️ Slack notification skipped: No active Slack integration found for user/tenant.`);
      return false;
    }

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 ReachInbox Alert: Hourly Email Rate Limit Reached',
          emoji: true,
        },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `The sender *${senderEmail}* has reached the configured hourly threshold of *${limit} emails/hour*.`,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender:*\n\`${senderEmail}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Current Window:*\n\`${hourWindow}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Volume Processed:*\n\`${count} / ${limit} emails\``,
          },
          {
            type: 'mrkdwn',
            text: `*Rescheduled Jobs:*\n\`${rescheduledCount || 1} emails moved\``,
          },
        ],
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `⏳ *Scheduler Action:* Future jobs are automatically deferred to the next hourly window (${nextWindowTime || 'top of next hour'}) without dropping any requests to protect sender reputation.`,
          },
        ],
      },
      {
        type: 'divider',
      },
    ];

    if (webhookUrl) {
      console.log(`📡 Sending Slack rate-limit alert via webhook to ${integration?.channelName || 'channel'}...`);
      await axios.post(webhookUrl, {
        text: `🚨 ReachInbox Alert: Hourly Email Rate Limit Reached for ${senderEmail} (${count}/${limit})`,
        blocks,
      });
      console.log(`✅ Slack rate-limit alert sent successfully!`);
      return true;
    } else if (accessToken && channelId) {
      const slackClient = new WebClient(accessToken);
      console.log(`📡 Sending Slack rate-limit alert via Web API to channel ${channelId}...`);
      await slackClient.chat.postMessage({
        channel: channelId,
        text: `🚨 ReachInbox Alert: Hourly Email Rate Limit Reached for ${senderEmail} (${count}/${limit})`,
        blocks,
      });
      console.log(`✅ Slack rate-limit alert sent successfully!`);
      return true;
    }

    return false;
  } catch (error: any) {
    console.error('❌ Failed to send Slack rate limit alert:', error.message);
    return false;
  }
}
