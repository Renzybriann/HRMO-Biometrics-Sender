import { supabase } from './supabase';

export interface Office {
  id: string;
  name: string;
  emails: string[];
  createdAt: string;
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
}

export interface Settings {
  autoSendEnabled: boolean;
  activeTemplateId: string;
  scheduler: SchedulerConfig;
  scheduledOfficeIds: string[];
}

const DEFAULT_TEMPLATE: EmailTemplate = {
  id: 'default',
  name: 'Default Template',
  subject: 'Biometrics Report – {{month}} | {{officeName}}',
  body: `Dear {{officeName}},

Please find attached the biometrics report(s) for the current period ({{month}}).

Kindly review the attached document(s) at your earliest convenience and ensure that all records are properly acknowledged.

If you have any questions or discrepancies to report, please do not hesitate to reach out to us directly.

Thank you for your continued cooperation.

Best regards,
{{senderName}}`,
  isDefault: true,
  createdAt: new Date().toISOString(),
};

const DEFAULT_SCHEDULER: SchedulerConfig = {
  enabled: true,
  dayOfMonth: 15,
  hour: 8,
  minute: 0,
};

export function generateId(): string {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

// --- Offices ---

export async function getOffices(): Promise<Office[]> {
  const { data, error } = await supabase
    .from('offices')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return data.map((o) => ({
    id: o.id,
    name: o.name,
    emails: o.emails,
    createdAt: o.created_at,
  }));
}

export async function addOffice(office: Office): Promise<void> {
  const { error } = await supabase.from('offices').insert({
    id: office.id,
    name: office.name,
    emails: office.emails,
    created_at: office.createdAt,
  });
  if (error) throw new Error(error.message);
}

export async function updateOffice(office: Office): Promise<void> {
  const { error } = await supabase
    .from('offices')
    .update({ name: office.name, emails: office.emails })
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
  return { id: data.id, name: data.name, emails: data.emails, createdAt: data.created_at };
}

export async function findOfficeByName(name: string): Promise<Office | null> {
  const { data, error } = await supabase
    .from('offices').select('*').ilike('name', name).single();
  if (error || !data) return null;
  return { id: data.id, name: data.name, emails: data.emails, createdAt: data.created_at };
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

  const { data, error } = await supabase
    .from('templates').update(update).eq('id', template.id).select().single();
  if (error) throw new Error(error.message);
  return { id: data.id, name: data.name, subject: data.subject, body: data.body, isDefault: data.is_default, createdAt: data.created_at };
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
  };
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  const update: Record<string, unknown> = {};
  if (patch.autoSendEnabled !== undefined) update.auto_send_enabled = patch.autoSendEnabled;
  if (patch.activeTemplateId !== undefined) update.active_template_id = patch.activeTemplateId;
  if (patch.scheduler !== undefined) update.scheduler = patch.scheduler;
  if (patch.scheduledOfficeIds !== undefined) update.scheduled_office_ids = patch.scheduledOfficeIds;

  const { error } = await supabase.from('settings').update(update).eq('id', 1);
  if (error) throw new Error(error.message);
}

// --- Logs ---

export async function getLogs(): Promise<SendLog[]> {
  const { data, error } = await supabase
    .from('logs').select('*').order('sent_at', { ascending: false }).limit(100);
  if (error) throw new Error(error.message);
  return data.map((l) => ({
    id: l.id,
    officeId: l.office_id,
    officeName: l.office_name,
    email: l.email,
    sentAt: l.sent_at,
    status: l.status,
    filesCount: l.files_count,
    error: l.error ?? undefined,
  }));
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

export interface CutoffLabel {
  id: string;
  startDate: string; // ISO date e.g. "2026-05-01"
  endDate: string;   // ISO date e.g. "2026-05-15"
  url: string;
  createdAt: string;
}

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