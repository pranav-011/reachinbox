import axios from 'axios';
import { SchedulePayload, ScheduledEmail, Pagination, DashboardStats, QueueMetrics, SlackStatus } from '../types/index.js';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('reachinbox_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const emailApi = {
  schedule: async (payload: SchedulePayload) => {
    const res = await api.post<{ success: boolean; count: number; emails: ScheduledEmail[] }>('/emails/schedule', payload);
    return res.data;
  },

  getScheduled: async (page = 1, limit = 50, search = '') => {
    const res = await api.get<{ emails: ScheduledEmail[]; pagination: Pagination }>('/emails/scheduled', {
      params: { page, limit, search },
    });
    return res.data;
  },

  getSent: async (page = 1, limit = 50, search = '', status?: string) => {
    const res = await api.get<{ emails: ScheduledEmail[]; pagination: Pagination }>('/emails/sent', {
      params: { page, limit, search, status },
    });
    return res.data;
  },

  search: async (query: string, status?: string, page = 1) => {
    const res = await api.get<{ emails: ScheduledEmail[]; total: number; engine: string; pagination: Pagination }>('/emails/search', {
      params: { q: query, status, page },
    });
    return res.data;
  },

  cancel: async (id: string) => {
    const res = await api.delete<{ success: boolean; message: string; email: ScheduledEmail }>(`/emails/${id}`);
    return res.data;
  },

  getStats: async () => {
    const res = await api.get<{
      stats: DashboardStats;
      queue: QueueMetrics;
      rateLimit: any;
      elasticsearchConnected: boolean;
    }>('/emails/stats');
    return res.data;
  },
};

export const authApi = {
  loginWithGoogle: async (credential: string) => {
    const res = await api.post('/auth/google', { credential });
    return res.data;
  },

  loginDemo: async (email?: string, name?: string) => {
    const res = await api.post('/auth/demo', { email, name });
    return res.data;
  },

  getMe: async () => {
    const res = await api.get('/auth/me');
    return res.data;
  },
};

export const slackApi = {
  getStatus: async () => {
    const res = await api.get<SlackStatus>('/slack/status');
    return res.data;
  },

  saveWebhook: async (webhookUrl: string, channelName?: string) => {
    const res = await api.post('/slack/webhook', { webhookUrl, channelName });
    return res.data;
  },

  testAlert: async (senderEmail?: string) => {
    const res = await api.post<{ success: boolean; message: string }>('/slack/test', { senderEmail });
    return res.data;
  },

  disconnect: async () => {
    const res = await api.post<{ success: boolean; message: string }>('/slack/disconnect');
    return res.data;
  },
};

export default api;
