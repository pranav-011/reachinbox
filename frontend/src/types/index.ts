export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
}

export interface ScheduledEmail {
  id: string;
  userId?: string | null;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  scheduledTime: string;
  status: 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'CANCELLED' | 'RATE_LIMITED';
  jobId?: string | null;
  delaySeconds: number;
  hourlyLimit: number;
  sentAt?: string | null;
  failedAt?: string | null;
  errorMessage?: string | null;
  etherealPreviewUrl?: string | null;
  messageId?: string | null;
  attempts: number;
  rescheduledCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface SchedulePayload {
  subject: string;
  body: string;
  recipients: string[];
  senderEmail?: string;
  startTime?: string;
  delayBetweenEmails?: number;
  hourlyLimit?: number;
}

export interface DashboardStats {
  total: number;
  scheduled: number;
  sent: number;
  failed: number;
  rateLimited: number;
}

export interface QueueMetrics {
  waiting: number;
  active: number;
  delayed: number;
  completed: number;
  failed: number;
  isPaused: boolean;
  total: number;
}

export interface SlackStatus {
  connected: boolean;
  teamName: string | null;
  channelName: string | null;
  hasDefaultFallback: boolean;
  oauthConfigured: boolean;
}
