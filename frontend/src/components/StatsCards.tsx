import React from 'react';
import { DashboardStats, QueueMetrics } from '../types/index.js';
import { Clock, Send, AlertTriangle, Layers, Cpu } from 'lucide-react';

interface StatsCardsProps {
  stats: DashboardStats | null;
  queue: QueueMetrics | null;
  rateLimitInfo: any;
  elasticsearchConnected: boolean;
}

export const StatsCards: React.FC<StatsCardsProps> = ({
  stats,
  queue,
  rateLimitInfo,
  elasticsearchConnected,
}) => {
  const cards = [
    {
      title: 'Total Emails',
      value: stats?.total ?? 0,
      icon: Layers,
      color: 'text-indigo-400',
      bg: 'bg-indigo-500/10 border-indigo-500/20',
      subtext: 'Across all campaigns',
    },
    {
      title: 'Scheduled',
      value: stats?.scheduled ?? 0,
      icon: Clock,
      color: 'text-amber-400',
      bg: 'bg-amber-500/10 border-amber-500/20',
      subtext: `${queue?.delayed ?? 0} delayed in BullMQ`,
    },
    {
      title: 'Sent Successfully',
      value: stats?.sent ?? 0,
      icon: Send,
      color: 'text-emerald-400',
      bg: 'bg-emerald-500/10 border-emerald-500/20',
      subtext: `${stats?.failed ?? 0} failed attempts`,
    },
    {
      title: 'Rate Limit Incidents',
      value: stats?.rateLimited ?? 0,
      icon: AlertTriangle,
      color: 'text-purple-400',
      bg: 'bg-purple-500/10 border-purple-500/20',
      subtext: rateLimitInfo?.sender
        ? `${rateLimitInfo.sender.count}/${rateLimitInfo.sender.limit} this hour`
        : 'Auto-rescheduled safely',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {cards.map((card, idx) => {
        const Icon = card.icon;
        return (
          <div
            key={idx}
            className="p-4 rounded-xl border backdrop-blur-sm bg-white dark:bg-[#161922]/90 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-all shadow-sm"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{card.title}</span>
              <div className={`p-2 rounded-lg border ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{card.value}</div>
            <div className="flex items-center justify-between mt-1 text-[11px] text-slate-500 dark:text-slate-400">
              <span>{card.subtext}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
};
