import { Response } from 'express';
import { AuthenticatedRequest } from '../middlewares/authMiddleware.js';
import {
  getSlackOAuthUrl,
  exchangeSlackCode,
  saveManualWebhook,
  disconnectSlack,
  sendRateLimitSlackAlert,
} from '../services/slackService.js';
import { prisma } from '../db/prisma.js';
import { config } from '../config/index.js';

export async function startSlackOAuth(req: AuthenticatedRequest, res: Response) {
  const userId = req.user?.id || (req.query.userId as string) || 'default-user';
  const url = getSlackOAuthUrl(userId);

  if (!url) {
    return res.status(400).json({
      error: 'Slack Client ID is not configured. You can connect by pasting an Incoming Webhook URL instead.',
    });
  }

  return res.redirect(url);
}

export async function slackOAuthCallback(req: AuthenticatedRequest, res: Response) {
  try {
    const code = req.query.code as string;
    const userId = (req.query.state as string) || req.user?.id || 'default-user';

    if (!code) {
      return res.redirect(`${config.frontendUrl}?slack_error=missing_code`);
    }

    await exchangeSlackCode(code, userId);
    return res.redirect(`${config.frontendUrl}?slack_connected=true`);
  } catch (error: any) {
    console.error('❌ Slack OAuth callback error:', error);
    return res.redirect(`${config.frontendUrl}?slack_error=${encodeURIComponent(error.message)}`);
  }
}

export async function getSlackStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id;
    let integration = null;

    if (userId) {
      integration = await prisma.slackIntegration.findUnique({
        where: { userId },
      });
    }

    if (!integration) {
      integration = await prisma.slackIntegration.findFirst({
        where: { isActive: true },
      });
    }

    const isConnected = !!(integration?.isActive && (integration?.webhookUrl || integration?.accessToken));

    return res.json({
      connected: isConnected,
      teamName: integration?.teamName || null,
      channelName: integration?.channelName || null,
      hasDefaultFallback: !!config.slack.defaultWebhookUrl,
      oauthConfigured: !!config.slack.clientId,
    });
  } catch (error: any) {
    console.error('❌ Error getting Slack status:', error);
    return res.status(500).json({ error: 'Failed to check Slack status' });
  }
}

export async function configureManualWebhook(req: AuthenticatedRequest, res: Response) {
  try {
    const { webhookUrl, channelName } = req.body;
    if (!webhookUrl || !webhookUrl.startsWith('https://hooks.slack.com/')) {
      return res.status(400).json({ error: 'Please enter a valid Slack Incoming Webhook URL (starts with https://hooks.slack.com/)' });
    }

    const userId = req.user?.id || 'default-user';

    // Verify and ensure user exists in DB first
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: req.user?.email || 'default@reachinbox.ai',
        name: req.user?.name || 'Default User',
      },
    });

    const integration = await saveManualWebhook(userId, webhookUrl, channelName);

    return res.json({
      success: true,
      message: 'Slack webhook connected successfully!',
      integration: {
        channelName: integration.channelName,
        isActive: integration.isActive,
      },
    });
  } catch (error: any) {
    console.error('❌ Error configuring Slack webhook:', error);
    return res.status(500).json({ error: error.message || 'Failed to save webhook' });
  }
}

export async function testSlackNotification(req: AuthenticatedRequest, res: Response) {
  try {
    const senderEmail = (req.body.senderEmail as string) || 'outreach@reachinbox.ai';
    const userId = req.user?.id;

    const sent = await sendRateLimitSlackAlert({
      senderEmail,
      hourWindow: new Date().toISOString().slice(0, 13),
      count: 50,
      limit: 50,
      userId,
      rescheduledCount: 12,
      nextWindowTime: 'top of next hour',
    });

    if (sent) {
      return res.json({ success: true, message: 'Live rate limit alert dispatched to Slack successfully!' });
    } else {
      return res.status(400).json({
        error: 'Slack is not connected. Please connect via OAuth or provide an Incoming Webhook first.',
      });
    }
  } catch (error: any) {
    console.error('❌ Error testing Slack notification:', error);
    return res.status(500).json({ error: error.message || 'Failed to send Slack test notification' });
  }
}

export async function handleDisconnectSlack(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.user?.id || 'default-user';
    await disconnectSlack(userId);
    return res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (error: any) {
    console.error('❌ Error disconnecting Slack:', error);
    return res.status(500).json({ error: 'Failed to disconnect Slack' });
  }
}
