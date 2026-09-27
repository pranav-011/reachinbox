import React from 'react';
import { useAuth } from '../contexts/AuthContext.js';
import { GoogleLogin } from '@react-oauth/google';
import { X, Sparkles, UserCheck, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({ isOpen, onClose }) => {
  const { loginWithGoogle, loginDemo } = useAuth();
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

  if (!isOpen) return null;

  const handleGoogleSuccess = async (credentialResponse: any) => {
    try {
      if (credentialResponse.credential) {
        await loginWithGoogle(credentialResponse.credential);
        toast.success('Signed in with Google successfully!');
        onClose();
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
      onClose();
    } catch (err: any) {
      toast.error('Failed to log in with demo account');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#141721] border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-[#171a26]">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white">
              <Sparkles className="h-4 w-4" />
            </div>
            <h2 className="text-sm font-semibold text-white">Sign In to ReachInbox</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5 text-center">
          <div className="max-w-xs mx-auto">
            <h3 className="text-base font-bold text-white mb-1.5">Welcome Back</h3>
            <p className="text-xs text-slate-400">
              Sign in with your Google account to manage campaigns, monitor rate-limits, and view queue metrics.
            </p>
          </div>

          {/* Google Sign-in Container */}
          <div className="flex flex-col items-center justify-center min-h-[44px]">
            {googleClientId ? (
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={() => toast.error('Google Sign-In failed or was cancelled')}
                theme="filled_black"
                shape="rectangular"
                size="large"
                width="320"
                text="continue_with"
              />
            ) : (
              <div className="text-xs text-slate-500 py-1 flex items-center gap-1.5 justify-center">
                <ShieldCheck className="h-4 w-4 text-indigo-400" />
                <span>Google OAuth Ready (Add VITE_GOOGLE_CLIENT_ID in .env)</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-slate-800" />
            <span className="text-[10px] uppercase font-semibold text-slate-500">Fast Evaluator Mode</span>
            <div className="h-px flex-1 bg-slate-800" />
          </div>

          {/* Quick Demo Login */}
          <button
            onClick={handleDemoSignIn}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-white flex items-center justify-center gap-2 transition-all group"
          >
            <UserCheck className="h-4 w-4 text-emerald-400 group-hover:scale-110 transition-transform" />
            <span>Continue as Demo Outreach Lead</span>
          </button>
        </div>
      </div>
    </div>
  );
};

