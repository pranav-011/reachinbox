import React from 'react';
import { ScheduledEmail } from '../types/index.js';
import { CheckCircle2, XCircle, ExternalLink, Inbox } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface SentTableProps {
  emails: ScheduledEmail[];
  isLoading: boolean;
  onComposeClick: () => void;
}

export const SentTable: React.FC<SentTableProps> = ({ emails, isLoading, onComposeClick }) => {
  const formatSentDate = (dateStr?: string | null) => {
    if (!dateStr) return { relative: 'Just now', exact: '' };
    try {
      const d = new Date(dateStr);
      return {
        relative: formatDistanceToNow(d, { addSuffix: true }),
        exact: format(d, 'MMM d, yyyy · h:mm:ss a'),
      };
    } catch {
      return { relative: dateStr, exact: dateStr };
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden p-6 space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between animate-pulse">
            <div className="space-y-2">
              <div className="h-4 w-48 bg-slate-200 dark:bg-slate-800 rounded" />
              <div className="h-3 w-32 bg-slate-100 dark:bg-slate-800/60 rounded" />
            </div>
            <div className="h-6 w-24 bg-slate-200 dark:bg-slate-800 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-white dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center flex flex-col items-center justify-center">
        <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-500 dark:text-indigo-400 mb-3">
          <Inbox className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">No sent emails recorded yet</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
          Once your scheduled jobs execute, delivered emails with Ethereal SMTP test preview links will appear here.
        </p>
        <button
          onClick={onComposeClick}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all"
        >
          Schedule an Email
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-[#141721] border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 dark:bg-[#171a26] text-slate-500 dark:text-slate-400 uppercase tracking-wider text-[10px] font-semibold border-b border-slate-200 dark:border-slate-800">
            <tr>
              <th className="px-5 py-3.5">Email</th>
              <th className="px-5 py-3.5">Subject</th>
              <th className="px-5 py-3.5">Sender</th>
              <th className="px-5 py-3.5">Sent Time</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Ethereal Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {emails.map((email) => {
              const dateInfo = formatSentDate(email.sentAt || email.updatedAt);
              const isSuccess = email.status === 'SENT';

              return (
                <tr key={email.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                    <span className="font-mono text-xs">{email.recipient}</span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-700 dark:text-slate-300 max-w-xs truncate">
                    {email.subject}
                  </td>
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {email.senderEmail}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="text-slate-800 dark:text-slate-200">{dateInfo.relative}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">{dateInfo.exact}</div>
                  </td>
                  <td className="px-5 py-3.5">
                    {isSuccess ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" />
                        Delivered
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                        title={email.errorMessage || 'Failed to send'}
                      >
                        <XCircle className="h-3 w-3" />
                        Failed
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    {email.etherealPreviewUrl ? (
                      <a
                        href={email.etherealPreviewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/20 rounded-md transition-all shadow-sm group"
                      >
                        <span>View Ethereal</span>
                        <ExternalLink className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                      </a>
                    ) : (
                      <span className="text-[11px] text-slate-400 dark:text-slate-500">Preview unavailable</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
