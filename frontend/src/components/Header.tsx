import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { LogOut, ExternalLink, MessageSquare, Activity, Sparkles, Sun, Moon } from 'lucide-react';
import { SlackStatus } from '../types/index.js';

interface HeaderProps {
  slackStatus: SlackStatus | null;
  onOpenSlack: () => void;
  onOpenLogin: () => void;
}

export const Header: React.FC<HeaderProps> = ({ slackStatus, onOpenSlack, onOpenLogin }) => {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-[#12151e]/80 backdrop-blur-md sticky top-0 z-30 px-6 py-3.5 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
              <line x1="12" y1="22.08" x2="12" y2="12" />
            </svg>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight text-slate-900 dark:text-white">ReachInbox</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                Scheduler
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">Outbox Labs · Email Job Scheduler</p>
          </div>
        </div>

        {/* Action Controls & User Profile */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Light / Dark Mode Toggle Button */}
          <button
            onClick={toggleTheme}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-sm"
            title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400 animate-spin-slow" />
                <span className="font-medium">Light</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-indigo-600" />
                <span className="font-medium">Dark</span>
              </>
            )}
          </button>

          {/* Live BullMQ Queue Monitor */}
          <a
            href="/admin/queues"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 rounded-lg transition-colors group"
            title="Open real-time BullMQ dashboard"
          >
            <Activity className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="hidden md:inline">BullMQ Board</span>
            <ExternalLink className="h-3 w-3 text-slate-400 dark:text-slate-500" />
          </a>

          {/* Slack Integration Status */}
          <button
            onClick={onOpenSlack}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-all ${
              slackStatus?.connected
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
                : 'bg-slate-100 dark:bg-slate-800/80 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700/80'
            }`}
          >
            <MessageSquare className={`h-3.5 w-3.5 ${slackStatus?.connected ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-400'}`} />
            <span>{slackStatus?.connected ? 'Slack Connected' : 'Connect Slack'}</span>
            {slackStatus?.connected && (
              <span className="h-2 w-2 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse ml-0.5" />
            )}
          </button>

          {/* User Profile / Auth */}
          {user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={user.name || 'User'}
                    className="h-8 w-8 rounded-full border border-indigo-500/40 object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-indigo-600 font-semibold text-xs flex items-center justify-center text-white">
                    {(user.name || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[140px]">
                    {user.name || 'ReachInbox User'}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">{user.email}</div>
                </div>
              </div>

              <button
                onClick={logout}
                className="p-1.5 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                title="Log out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenLogin}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
