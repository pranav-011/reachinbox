import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { useTheme } from '../contexts/ThemeContext.js';
import { GoogleLogin } from '@react-oauth/google';
import { Sparkles, ShieldCheck, UserCheck, Zap, Server, Bell, Search, Sun, Moon } from 'lucide-react';
import { toast } from 'sonner';

export const LoginScreen: React.FC = () => {
  const { loginWithGoogle, loginDemo } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      if (credentialResponse.credential) {
        await loginWithGoogle(credentialResponse.credential);
        toast.success('Signed in with Google successfully!');
      } else {
        toast.error('No credential received from Google');
      }
    } catch (err: any) {
      toast.error(err.message || 'Google sign in failed');
    }
  };

  const handleDemoSignIn = async () => {
    try {
      await loginDemo('outreach.lead@reachinbox.ai', 'ReachInbox Lead');
      toast.success('Signed in with demo engineer account');
    } catch (err: any) {
      toast.error('Failed to log in with demo account');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0c13] text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-indigo-500 selection:text-white relative overflow-hidden transition-colors duration-200">
      {/* Background glow effects */}
      <div className="absolute top-[-15%] left-[20%] w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-600/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[15%] w-[450px] h-[450px] bg-purple-500/10 dark:bg-purple-600/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Top Header */}
      <header className="border-b border-slate-200 dark:border-slate-800/80 bg-white/80 dark:bg-[#12151e]/60 backdrop-blur-md px-6 py-4 z-10 transition-colors">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
                <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
                <line x1="12" y1="22.08" x2="12" y2="12" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base tracking-tight text-slate-900 dark:text-white">ReachInbox</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                  Scheduler
                </span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-500 dark:text-slate-400 hidden sm:block">
              Outbox Labs · Email Job Scheduler
            </div>
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/90 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-all shadow-sm"
              title={`Switch to ${theme === 'dark' ? 'Light' : 'Dark'} Mode`}
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                  <span>Light</span>
                </>
              ) : (
                <>
                  <Moon className="h-3.5 w-3.5 text-indigo-600" />
                  <span>Dark</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Center Auth Card */}
      <main className="flex-1 flex items-center justify-center p-6 z-10">
        <div className="w-full max-w-md bg-white dark:bg-[#131622]/90 border border-slate-200 dark:border-slate-800/80 rounded-2xl shadow-xl dark:shadow-2xl backdrop-blur-xl p-8 space-y-6">
          <div className="text-center space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              <span>Production-Grade Scheduler</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">Sign In to Dashboard</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed max-w-sm mx-auto">
              Schedule email campaigns at scale with distributed rate limits, worker concurrency, and live Ethereal delivery previews.
            </p>
          </div>

          {/* Google Sign-in Button */}
          <div className="flex flex-col items-center justify-center pt-2">
            {googleClientId ? (
              <div className="w-full flex justify-center">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={() => toast.error('Google Sign-In failed or was cancelled')}
                  theme={theme === 'dark' ? 'filled_black' : 'outline'}
                  shape="rectangular"
                  size="large"
                  width="340"
                  text="continue_with"
                />
              </div>
            ) : (
              <div className="text-xs text-slate-500 py-2 flex items-center gap-1.5 justify-center">
                <ShieldCheck className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                <span>Google OAuth Ready (Configure Client ID in .env)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
            <span className="text-[10px] uppercase font-semibold text-slate-400 dark:text-slate-500 tracking-wider">Or</span>
            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
          </div>

          {/* Quick Demo Login */}
          <button
            onClick={handleDemoSignIn}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-800 dark:text-white flex items-center justify-center gap-2 transition-all hover:border-slate-300 dark:hover:border-slate-600 group shadow-sm"
          >
            <UserCheck className="h-4 w-4 text-emerald-500 dark:text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Continue as Demo Outreach Lead</span>
          </button>

          {/* Architecture Feature Grid */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 grid grid-cols-2 gap-3 text-[11px] text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>BullMQ (0 Cron)</span>
            </div>
            <div className="flex items-center gap-2">
              <Server className="h-3.5 w-3.5 text-purple-500 dark:text-purple-400 shrink-0" />
              <span>Redis Concurrency</span>
            </div>
            <div className="flex items-center gap-2">
              <Bell className="h-3.5 w-3.5 text-pink-500 dark:text-pink-400 shrink-0" />
              <span>Slack Rate Alerts</span>
            </div>
            <div className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5 text-emerald-500 dark:text-emerald-400 shrink-0" />
              <span>Elasticsearch Fuzzy</span>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800/80 py-4 text-center text-xs text-slate-400 dark:text-slate-500 z-10">
        ReachInbox Hiring Assignment · Full-stack Email Job Scheduler
      </footer>
    </div>
  );
};
