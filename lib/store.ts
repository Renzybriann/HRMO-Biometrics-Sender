import { supabase } from './supabase';
import { DEFAULT_INTRO, DEFAULT_SECTIONS } from './email-content';
import type { CutoffLabel, EmailTemplate, Office, SchedulerConfig, SendLog, Settings } from './types';
export type { CutoffLabel, EmailTemplate, Office, SchedulerConfig, SendLog, Settings } from './types';

const DEFAULT_TEMPLATE: EmailTemplate = {
  id: 'default',
  name: 'HRMO Biometric Attendance',
  subject: 'Biometric Attendance Data – {{period}} | {{officeName}}',
  body: DEFAULT_INTRO,
  sections: DEFAULT_SECTIONS,
  isDefault: true,
  createdAt: new Date().toISOString(),
};

const DEFAULT_SCHEDULER: SchedulerConfig = {
  enabled: true,
  dayOfMonth: 15,
  hour: 8,
  minute: 0,
  sendIntervalSeconds: 30,
};

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// --- Offices ---

export async function getOffices(): Promise<Office[]> {
  const { data, error } = await supabase
    .from('offices')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map((o) => ({
    id: o.id,
    name: o.name,
    emails: o.emails,
    createdAt: o.created_at,
    sortOrder: o.sort_order ?? 0,
  }));
}

export async function addOffice(office: Office): Promise<void> {
  const { error } = await supabase.from('offices').insert({
    id: office.id,
    name: office.name,
    emails: office.emails,
    created_at: office.createdAt,
    sort_order: office.sortOrder ?? 0,
  });
  if (error) throw new Error(error.message);
}

export async function updateOffice(office: Office): Promise<void> {
  const { error } = await supabase
    .from('offices')
    .update({ name: office.name, emails: office.emails, sort_order: office.sortOrder })
    .eq('id', office.id);
  if (error) throw new Error(error.message);
}

export async function deleteOffice(id: string): Promise<void> {
  const { error } = await supabase.from('offices').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function findOfficeById(id: string): Promise<Office | null> {
  const { data, error } = await supabase
    .from('offices').select('*').eq('id', id).single();
  if (error || !data) return null;
  return { id: data.id, name: data.name, emails: data.emails, createdAt: data.created_at, sortOrder: data.sort_order ?? 0 };
}

export async function findOfficeByName(name: string): Promise<Office | null> {
  const { data, error } = await supabase
    .from('offices').select('*').ilike('name', name).single();
  if (error || !data) return null;
  return { id: data.id, name: data.name, emails: data.emails, createdAt: data.created_at, sortOrder: data.sort_order ?? 0 };
}

// --- Templates ---

export async function getTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from('templates')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map((t) => ({
    id: t.id,
    name: t.name,
    subject: t.subject,
    body: t.body,
    sections: t.sections ?? undefined,
    isDefault: t.is_default,
    createdAt: t.created_at,
  }));
}

export async function addTemplate(template: EmailTemplate): Promise<void> {
  const { error } = await supabase.from('templates').insert({
    id: template.id,
    name: template.name,
    subject: template.subject,
    body: template.body,
    ...(template.sections !== undefined ? { sections: template.sections } : {}),
    is_default: template.isDefault,
    created_at: template.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function updateTemplate(template: Partial<EmailTemplate> & { id: string }): Promise<EmailTemplate> {
  const update: Record<string, unknown> = {};
  if (template.name !== undefined) update.name = template.name;
  if (template.subject !== undefined) update.subject = template.subject;
  if (template.body !== undefined) update.body = template.body;
  if (template.sections !== undefined) update.sections = template.sections;

  const { data, error } = await supabase
    .from('templates').update(update).eq('id', template.id).select().single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, subject: data.subject, body: data.body, sections: data.sections ?? undefined, isDefault: data.is_default, createdAt: data.created_at };
}

export async function deleteTemplate(id: string): Promise<void> {
  const { error } = await supabase.from('templates').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function getActiveTemplate(settings: Settings, templates: EmailTemplate[]): Promise<EmailTemplate> {
  return templates.find(t => t.id === settings.activeTemplateId) ?? templates[0] ?? DEFAULT_TEMPLATE;
}

// --- Settings ---

export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings').select('*').eq('id', 1).single();
  if (error || !data) {
    return { autoSendEnabled: true, activeTemplateId: 'default', scheduler: DEFAULT_SCHEDULER, scheduledOfficeIds: [] };
  }
  return {
    autoSendEnabled: data.auto_send_enabled,
    activeTemplateId: data.active_template_id ?? 'default',
    scheduler: { ...DEFAULT_SCHEDULER, ...(data.scheduler ?? {}) },
    scheduledOfficeIds: data.scheduled_office_ids ?? [],
    emailFooter: data.email_footer ?? undefined,
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.autoSendEnabled !== undefined) update.auto_send_enabled = patch.autoSendEnabled;
  if (patch.activeTemplateId !== undefined) update.active_template_id = patch.activeTemplateId;
  if (patch.scheduler !== undefined) update.scheduler = patch.scheduler;
  if (patch.scheduledOfficeIds !== undefined) update.scheduled_office_ids = patch.scheduledOfficeIds;
  if (patch.emailFooter !== undefined) update.email_footer = patch.emailFooter;

  const { data, error } = await supabase
    .from('settings')
    .update(update)
    .eq('id', 1)
    .select('id');
  if (error) throw new Error(error.message);
  if (data && data.length > 0) return;

  const { error: insertError } = await supabase.from('settings').insert({
    id: 1,
    auto_send_enabled: patch.autoSendEnabled ?? true,
    active_template_id: patch.activeTemplateId ?? 'default',
    scheduler: patch.scheduler ?? DEFAULT_SCHEDULER,
    scheduled_office_ids: patch.scheduledOfficeIds ?? [],
    ...(patch.emailFooter !== undefined ? { email_footer: patch.emailFooter } : {}),
  });
  if (insertError) throw new Error(insertError.message);
}

// --- Logs ---

export interface LogQueryOptions {
  from?: string;
  to?: string;
  officeId?: string;
  status?: 'success' | 'failed';
  limit?: number;
  offset?: number;
}

function mapLog(l: any): SendLog {
  return {
    id: l.id,
    officeId: l.office_id,
    officeName: l.office_name,
    email: l.email,
    sentAt: l.sent_at,
    status: l.status,
    filesCount: l.files_count,
    error: l.error ?? undefined,
  };
}

export async function getLogsPage(options: LogQueryOptions = {}): Promise<{ logs: SendLog[]; total: number }> {
  let query = supabase
    .from('logs')
    .select('*', { count: 'exact' })
    .order('sent_at', { ascending: false });

  if (options.from) query = query.gte('sent_at', options.from);
  if (options.to) query = query.lte('sent_at', options.to);
  if (options.officeId) query = query.eq('office_id', options.officeId);
  if (options.status) query = query.eq('status', options.status);

  const limit = Math.max(1, Math.min(options.limit ?? 500, 1000));
  const offset = Math.max(0, options.offset ?? 0);
  const { data, error, count } = await query.range(offset, offset + limit - 1);
  if (error) throw new Error(error.message);
  return { logs: data.map(mapLog), total: count ?? 0 };
}

export async function getLogs(options: LogQueryOptions = {}): Promise<SendLog[]> {
  const page = await getLogsPage(options);
  return page.logs;
}

export async function addLog(log: SendLog): Promise<void> {
  const { error } = await supabase.from('logs').insert({
    id: log.id,
    office_id: log.officeId,
    office_name: log.officeName,
    email: log.email,
    sent_at: log.sentAt,
    status: log.status,
    files_count: log.filesCount,
    error: log.error ?? null,
  });
  if (error) throw new Error(error.message);
}

// --- Storage ---

export async function getOfficePDFs(officeName: string): Promise<string[]> {
  const folder = encodeOfficeName(officeName);
  const { data, error } = await supabase.storage.from('biometrics-pdfs').list(folder);
  if (error || !data) return [];
  return data
    .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    .map((f) => `${folder}/${f.name}`);
}

export async function getPDFBuffer(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage.from('biometrics-pdfs').download(storagePath);
  if (error || !data) throw new Error(`Failed to download ${storagePath}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadPDF(officeName: string, fileName: string, buffer: Buffer): Promise<void> {
  const folder = encodeOfficeName(officeName);
  const { error } = await supabase.storage.from('biometrics-pdfs').upload(
    `${folder}/${fileName}`, buffer, { contentType: 'application/pdf', upsert: true }
  );
  if (error) throw new Error(error.message);
}

export async function deletePDF(officeName: string, fileName: string): Promise<void> {
  const folder = encodeOfficeName(officeName);
  const { error } = await supabase.storage.from('biometrics-pdfs').remove([`${folder}/${fileName}`]);
  if (error) throw new Error(error.message);
}

export async function listPDFsWithMeta(officeName: string) {
  const folder = encodeOfficeName(officeName);
  const { data, error } = await supabase.storage
    .from('biometrics-pdfs')
    .list(folder, { sortBy: { column: 'created_at', order: 'asc' } });
  if (error || !data) return [];
  return data
    .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    .map((f) => ({
      name: f.name,
      size: f.metadata?.size ?? 0,
      uploadedAt: f.created_at ?? new Date().toISOString(),
    }));
}

function encodeOfficeName(name: string): string {
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}

// --- Labels ---

export async function getLabels(): Promise<CutoffLabel[]> {
  const { data, error } = await supabase
    .from('labels')
    .select('*')
    .order('start_date', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map((l) => ({
    id: l.id,
    startDate: l.start_date,
    endDate: l.end_date,
    url: l.url,
    createdAt: l.created_at,
  }));
}

export async function addLabel(label: CutoffLabel): Promise<void> {
  const { error } = await supabase.from('labels').insert({
    id: label.id,
    start_date: label.startDate,
    end_date: label.endDate,
    url: label.url,
    created_at: label.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function updateLabel(label: Partial<CutoffLabel> & { id: string }): Promise<void> {
  const update: Record<string, unknown> = {};
  if (label.startDate !== undefined) update.start_date = label.startDate;
  if (label.endDate !== undefined) update.end_date = label.endDate;
  if (label.url !== undefined) update.url = label.url;
  const { error } = await supabase.from('labels').update(update).eq('id', label.id);
  if (error) throw new Error(error.message);
}

export async function deleteLabel(id: string): Promise<void> {
  const { error } = await supabase.from('labels').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
