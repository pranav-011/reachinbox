import React, { useState, useEffect, useCallback } from 'react';
import { Header } from './components/Header.js';
import { StatsCards } from './components/StatsCards.js';
import { ScheduledTable } from './components/ScheduledTable.js';
import { SentTable } from './components/SentTable.js';
import { ComposeModal } from './components/ComposeModal.js';
import { SlackModal } from './components/SlackModal.js';
import { LoginModal } from './components/LoginModal.js';
import { LoginScreen } from './components/LoginScreen.js';
import { SearchBar } from './components/SearchBar.js';
import { emailApi, slackApi } from './services/api.js';
import { useAuth } from './contexts/AuthContext.js';
import { useTheme } from './contexts/ThemeContext.js';
import { ScheduledEmail, DashboardStats, QueueMetrics, SlackStatus, SchedulePayload } from './types/index.js';
import { Plus, Clock, Send, RefreshCw, AlertCircle, Sparkles } from 'lucide-react';
import { toast, Toaster } from 'sonner';

export const App: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { theme } = useTheme();
  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>([]);
  const [sentEmails, setSentEmails] = useState<ScheduledEmail[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [queueMetrics, setQueueMetrics] = useState<QueueMetrics | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<any>(null);
  const [elasticsearchConnected, setElasticsearchConnected] = useState(false);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Check URL params for OAuth callbacks
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('slack_connected') === 'true') {
      toast.success('Slack connected successfully via OAuth!');
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (urlParams.get('slack_error')) {
      toast.error(`Slack connection failed: ${urlParams.get('slack_error')}`);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const fetchData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true);
    try {
      // If search query is present, call Elasticsearch search API
      if (searchQuery.trim().length > 0) {
        const searchRes = await emailApi.search(searchQuery.trim());
        const emails = searchRes.emails || [];
        setScheduledEmails(emails.filter((e) => ['SCHEDULED', 'PROCESSING', 'RATE_LIMITED'].includes(e.status)));
        setSentEmails(emails.filter((e) => ['SENT', 'FAILED'].includes(e.status)));
      } else {
        const [scheduledRes, sentRes, statsRes, slackRes] = await Promise.all([
          emailApi.getScheduled(1, 100),
          emailApi.getSent(1, 100),
          emailApi.getStats(),
          slackApi.getStatus(),
        ]);

        setScheduledEmails(scheduledRes.emails || []);
        setSentEmails(sentRes.emails || []);
        setStats(statsRes.stats);
        setQueueMetrics(statsRes.queue);
        setRateLimitInfo(statsRes.rateLimit);
        setElasticsearchConnected(statsRes.elasticsearchConnected);
        setSlackStatus(slackRes);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      if (!isSilent) setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [fetchData, user]);

  // Real-time polling every 4 seconds to observe delayed job execution in real-time
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      fetchData(true);
    }, 4000);
    return () => clearInterval(interval);
  }, [fetchData, user]);

  const handleManualRefresh = () => {
    setIsRefreshing(true);
    fetchData(true);
  };

  const handleScheduleSubmit = async (payload: SchedulePayload) => {
    await emailApi.schedule(payload);
    await fetchData(true);
  };

  const handleCancelEmail = async (id: string) => {
    try {
      await emailApi.cancel(id);
      toast.success('Scheduled email cancelled');
      await fetchData(true);
    } catch (err: any) {
      toast.error('Failed to cancel scheduled email');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#0a0c13] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center animate-pulse shadow-lg shadow-indigo-500/20">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Loading ReachInbox...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Toaster position="top-right" theme={theme === 'dark' ? 'dark' : 'light'} richColors />
        <LoginScreen />
      </>
    );
  }

  return (
    <div data-theme={theme} className="min-h-screen bg-[#f8fafc] dark:bg-[#0d0f17] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors duration-200">
      <Toaster position="top-right" theme={theme === 'dark' ? 'dark' : 'light'} richColors />

      {/* Top Header */}
      <Header
        slackStatus={slackStatus}
        onOpenSlack={() => setIsSlackOpen(true)}
        onOpenLogin={() => setIsLoginOpen(true)}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {/* Rate Limit Active Notice (if any) */}
        {stats && stats.rateLimited > 0 && (
          <div className="mb-6 p-4 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-700 dark:text-purple-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-purple-500 dark:text-purple-400 shrink-0" />
              <div className="text-xs">
                <span className="font-semibold text-slate-900 dark:text-white">Rate limit threshold reached: </span>
                {stats.rateLimited} email(s) have been safely delayed and rescheduled into the next hour window.
                {slackStatus?.connected && ' Notification dispatched to Slack.'}
              </div>
            </div>
            <button
              onClick={() => setActiveTab('scheduled')}
              className="text-xs font-semibold underline hover:text-purple-600 dark:hover:text-purple-200"
            >
              View Queue
            </button>
          </div>
        )}

        {/* Overview Stats Cards */}
        <StatsCards
          stats={stats}
          queue={queueMetrics}
          rateLimitInfo={rateLimitInfo}
          elasticsearchConnected={elasticsearchConnected}
        />

        {/* Dashboard Navigation & Action Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
          {/* Tabs */}
          <div className="flex items-center p-1 bg-slate-100 dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-xl">
            <button
              onClick={() => setActiveTab('scheduled')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'scheduled'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Clock className="h-3.5 w-3.5" />
              <span>Scheduled Emails</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === 'scheduled' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                }`}
              >
                {scheduledEmails.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('sent')}
              className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'sent'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Send className="h-3.5 w-3.5" />
              <span>Sent Emails</span>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                  activeTab === 'sent' ? 'bg-white/20 text-white' : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-400'
                }`}
              >
                {sentEmails.length}
              </span>
            </button>
          </div>

          {/* Search Bar & Action Buttons */}
          <div className="flex items-center gap-2.5">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              isElasticsearch={elasticsearchConnected}
              isSearching={isLoading}
            />

            <button
              onClick={handleManualRefresh}
              className="p-2 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white bg-white dark:bg-[#141721] hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl transition-colors shadow-sm"
              title="Refresh queue status"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-indigo-500 dark:text-indigo-400' : ''}`} />
            </button>

            <button
              onClick={() => setIsComposeOpen(true)}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-md shadow-indigo-600/30 transition-all shrink-0"
            >
              <Plus className="h-4 w-4" />
              <span>Compose New Email</span>
            </button>
          </div>
        </div>

        {/* Tab Content Tables */}
        {activeTab === 'scheduled' ? (
          <ScheduledTable
            emails={scheduledEmails}
            isLoading={isLoading}
            onCancel={handleCancelEmail}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        ) : (
          <SentTable
            emails={sentEmails}
            isLoading={isLoading}
            onComposeClick={() => setIsComposeOpen(true)}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>ReachInbox Scheduler · BullMQ + Redis + PostgreSQL + Elasticsearch</div>
          <div className="flex items-center gap-4 text-[11px]">
            <a href="/admin/queues" target="_blank" rel="noreferrer" className="hover:text-indigo-600 dark:hover:text-indigo-400">
              Live Queue Board
            </a>
            <span>•</span>
            <span className="text-emerald-500 dark:text-emerald-400 flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse" />
              Worker Active
            </span>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onSubmit={handleScheduleSubmit}
      />

      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        slackStatus={slackStatus}
        onRefreshStatus={() => fetchData(true)}
      />

      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
      />
    </div>
  );
};
