import React, { useState } from 'react';
import { X, MessageSquare, ExternalLink, CheckCircle2, Bell, AlertTriangle, Unlink, Send } from 'lucide-react';
import { SlackStatus } from '../types/index.js';
import { slackApi } from '../services/api.js';
import { toast } from 'sonner';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  slackStatus: SlackStatus | null;
  onRefreshStatus: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  slackStatus,
  onRefreshStatus,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channelName, setChannelName] = useState('#reachinbox-alerts');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  if (!isOpen) return null;

  const handleOAuthConnect = () => {
    const userStr = localStorage.getItem('reachinbox_user');
    let userId = '';
    if (userStr) {
      try {
        userId = JSON.parse(userStr).id || '';
      } catch {}
    }
    window.location.href = `/api/slack/oauth/start?userId=${encodeURIComponent(userId)}`;
  };

  const handleSaveWebhook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!webhookUrl.trim().startsWith('https://hooks.slack.com/')) {
      toast.error('Please enter a valid Slack Incoming Webhook URL');
      return;
    }

    setIsSaving(true);
    try {
      await slackApi.saveWebhook(webhookUrl.trim(), channelName.trim());
      toast.success('Slack webhook connected successfully!');
      setWebhookUrl('');
      onRefreshStatus();
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to save webhook');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    try {
      const res = await slackApi.testAlert('outreach@reachinbox.ai');
      toast.success(res.message || 'Live rate limit alert dispatched to Slack!');
    } catch (err: any) {
      toast.error(err.response?.data?.error || err.message || 'Failed to send test alert');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await slackApi.disconnect();
      toast.success('Slack disconnected successfully');
      onRefreshStatus();
    } catch (err: any) {
      toast.error('Failed to disconnect Slack');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-[#171a26]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-[#4A154B]/10 dark:bg-[#4A154B]/30 text-[#ECB22E] border border-[#ECB22E]/20">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Slack Rate-Limit Notifications</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Receive live alerts when senders reach hourly thresholds</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Connection Status Card */}
          <div
            className={`p-4 rounded-xl border flex items-center justify-between ${
              slackStatus?.connected
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`h-3 w-3 rounded-full ${
                  slackStatus?.connected ? 'bg-emerald-500 dark:bg-emerald-400 animate-pulse' : 'bg-slate-400 dark:bg-slate-600'
                }`}
              />
              <div>
                <div className="text-xs font-semibold text-slate-900 dark:text-white">
                  {slackStatus?.connected ? 'Slack is Connected' : 'Slack Not Connected'}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {slackStatus?.connected
                    ? `Alerts routing to ${slackStatus.channelName || slackStatus.teamName || 'configured webhook'}`
                    : 'Rate limit hits will execute safely without notifying Slack'}
                </div>
              </div>
            </div>

            {slackStatus?.connected && (
              <button
                onClick={handleDisconnect}
                className="px-2.5 py-1 text-[11px] font-medium text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors flex items-center gap-1"
              >
                <Unlink className="h-3 w-3" />
                Disconnect
              </button>
            )}
          </div>

          {/* Test Live Call Button */}
          {slackStatus?.connected && (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">Verify Live Dispatch</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">Send an instant test rate-limit alert to verify delivery</div>
              </div>
              <button
                onClick={handleTestAlert}
                disabled={isTesting}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-lg flex items-center gap-1.5 transition-all shadow-sm"
              >
                {isTesting ? (
                  <>
                    <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-3 w-3" />
                    Test Alert
                  </>
                )}
              </button>
            </div>
          )}

          {/* Method 1: OAuth Flow */}
          <div className="space-y-2">
            <label className="text-xs font-semibold text-slate-800 dark:text-slate-200 block">Method 1: Slack OAuth Flow</label>
            <button
              onClick={handleOAuthConnect}
              disabled={!slackStatus?.oauthConfigured}
              className="w-full py-2.5 px-4 rounded-xl bg-[#4A154B] hover:bg-[#5b195c] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-md shadow-[#4A154B]/30"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Connect with Slack via OAuth</span>
              <ExternalLink className="h-3.5 w-3.5 opacity-70" />
            </button>
            {!slackStatus?.oauthConfigured && (
              <p className="text-[11px] text-slate-500">
                (Configure SLACK_CLIENT_ID and SLACK_CLIENT_SECRET in backend .env to enable OAuth)
              </p>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500">Or Connect via Webhook</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Method 2: Manual Webhook URL */}
          <form onSubmit={handleSaveWebhook} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T.../B.../..."
                className="w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="#channel-name"
                className="w-1/2 px-3 py-2 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={isSaving || !webhookUrl}
                className="w-1/2 py-2 text-xs font-semibold text-white bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border border-slate-700 rounded-lg transition-all"
              >
                {isSaving ? 'Connecting...' : 'Connect Webhook'}
              </button>
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#171a26] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
