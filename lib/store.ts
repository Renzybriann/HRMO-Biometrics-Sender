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
  subject: string;
  body: string;
}

export const DEFAULT_TEMPLATE: EmailTemplate = {
  subject: 'Biometrics Report – {{month}} | {{officeName}}',
  body: `Dear {{officeName}},

Please find attached the biometrics report(s) for the current period ({{month}}).

Kindly review the attached document(s) at your earliest convenience and ensure that all records are properly acknowledged.

If you have any questions or discrepancies to report, please do not hesitate to reach out to us directly.

Thank you for your continued cooperation.

Best regards,
{{senderName}}`,
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
    .from('offices')
    .select('*')
    .eq('id', id)
    .single();
  if (error) return null;
  return { id: data.id, name: data.name, emails: data.emails, createdAt: data.created_at };
}

export async function findOfficeByName(name: string): Promise<Office | null> {
  const { data, error } = await supabase
    .from('offices')
    .select('*')
    .ilike('name', name)
    .single();
  if (error) return null;
  return { id: data.id, name: data.name, emails: data.emails, createdAt: data.created_at };
}

// --- Logs ---

export async function getLogs(): Promise<SendLog[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(100);
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

// --- Settings ---

export async function getSettings(): Promise<{
  autoSendEnabled: boolean;
  emailTemplate: EmailTemplate;
}> {
  const { data, error } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) {
    return { autoSendEnabled: true, emailTemplate: DEFAULT_TEMPLATE };
  }
  return {
    autoSendEnabled: data.auto_send_enabled,
    emailTemplate: data.email_template ?? DEFAULT_TEMPLATE,
  };
}

export async function updateSettings(settings: {
  autoSendEnabled?: boolean;
  emailTemplate?: EmailTemplate;
}): Promise<void> {
  const update: Record<string, unknown> = {};
  if (settings.autoSendEnabled !== undefined)
    update.auto_send_enabled = settings.autoSendEnabled;
  if (settings.emailTemplate !== undefined)
    update.email_template = settings.emailTemplate;

  const { error } = await supabase.from('settings').update(update).eq('id', 1);
  if (error) throw new Error(error.message);
}

// --- Supabase Storage (replaces local uploads folder) ---

export async function getOfficePDFs(officeName: string): Promise<string[]> {
  const folder = encodeOfficeName(officeName);
  const { data, error } = await supabase.storage
    .from('biometrics-pdfs')
    .list(folder);
  if (error || !data) return [];
  return data
    .filter((f) => f.name.toLowerCase().endsWith('.pdf'))
    .map((f) => `${folder}/${f.name}`);
}

export async function getPDFBuffer(storagePath: string): Promise<Buffer> {
  const { data, error } = await supabase.storage
    .from('biometrics-pdfs')
    .download(storagePath);
  if (error || !data) throw new Error(`Failed to download ${storagePath}`);
  return Buffer.from(await data.arrayBuffer());
}

export async function uploadPDF(
  officeName: string,
  fileName: string,
  buffer: Buffer
): Promise<void> {
  const folder = encodeOfficeName(officeName);
  const { error } = await supabase.storage
    .from('biometrics-pdfs')
    .upload(`${folder}/${fileName}`, buffer, {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (error) throw new Error(error.message);
}

export async function deletePDF(
  officeName: string,
  fileName: string
): Promise<void> {
  const folder = encodeOfficeName(officeName);
  const { error } = await supabase.storage
    .from('biometrics-pdfs')
    .remove([`${folder}/${fileName}`]);
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
  // Safe folder name for Supabase storage paths
  return name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
}