import React from 'react';
import { ScheduledEmail } from '../types/index.js';
import { Clock, Ban, AlertCircle, Calendar } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

interface ScheduledTableProps {
  emails: ScheduledEmail[];
  isLoading: boolean;
  onCancel: (id: string) => void;
  onComposeClick: () => void;
}

export const ScheduledTable: React.FC<ScheduledTableProps> = ({
  emails,
  isLoading,
  onCancel,
  onComposeClick,
}) => {
  const getStatusBadge = (status: ScheduledEmail['status']) => {
    switch (status) {
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-ping" />
            Processing
          </span>
        );
      case 'RATE_LIMITED':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20" title="Hourly threshold reached; auto-rescheduled to next hour window">
            <AlertCircle className="h-3 w-3" />
            Rate Limited (Rescheduled)
          </span>
        );
      case 'SCHEDULED':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="h-3 w-3" />
            Scheduled
          </span>
        );
    }
  };

  const formatScheduledDate = (dateStr: string) => {
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
          <Calendar className="h-6 w-6" />
        </div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-1">No scheduled emails in queue</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-4">
          All pending outreach jobs have executed or none are currently scheduled.
        </p>
        <button
          onClick={onComposeClick}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 rounded-lg shadow-sm transition-all"
        >
          Compose New Email
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
              <th className="px-5 py-3.5">Scheduled Time</th>
              <th className="px-5 py-3.5">Delay</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60">
            {emails.map((email) => {
              const dateInfo = formatScheduledDate(email.scheduledTime);
              return (
                <tr key={email.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors group">
                  <td className="px-5 py-3.5 font-medium text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs">{email.recipient}</span>
                    </div>
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
                  <td className="px-5 py-3.5 text-slate-500 dark:text-slate-400 font-mono text-[11px]">
                    {email.delaySeconds}s delay
                  </td>
                  <td className="px-5 py-3.5">
                    {getStatusBadge(email.status)}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => onCancel(email.id)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
                      title="Cancel this scheduled send"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      <span>Cancel</span>
                    </button>
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
