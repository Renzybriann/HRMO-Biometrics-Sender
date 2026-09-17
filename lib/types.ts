export interface Office {
  id: string;
  name: string;
  emails: string[];
  createdAt: string;
  sortOrder: number;
}

export interface SendLog {
  id: string;
  officeId: string;
  officeName: string;
  email: string;
  sentAt: string;
  status: 'success' | 'failed';
  filesCount: number;
  error?: string;
}

export interface PDFFile {
  name: string;
  size: number;
  uploadedAt: string;
}

export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  isDefault: boolean;
  createdAt: string;
}

export interface SchedulerConfig {
  enabled: boolean;
  dayOfMonth: number;
  hour: number;
  minute: number;
  sendIntervalSeconds: number;
}

export interface Settings {
  autoSendEnabled: boolean;
  activeTemplateId: string;
  scheduler: SchedulerConfig;
  scheduledOfficeIds: string[];
}

export type QueueStatus = 'idle' | 'running' | 'aborted' | 'done';

export interface QueueItem {
  officeId: string;
  officeName: string;
  status: 'pending' | 'sending' | 'sent' | 'failed' | 'retrying';
  error?: string;
  attempt: number;
}

export interface CutoffLabel {
  id: string;
  startDate: string;
  endDate: string;
  url: string;
  createdAt: string;
}
