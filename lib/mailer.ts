import nodemailer from 'nodemailer';
import path from 'path';
import { getPDFBuffer } from './store';
import type { EmailTemplate } from './store';

function createTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD,
    },
  });
}

function resolvePlaceholders(text: string, vars: Record<string, string>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? `{{${key}}}`);
}

export interface SendEmailOptions {
  to: string | string[];
  officeName: string;
  pdfPaths: string[]; // now Supabase storage paths e.g. "office_name/file.pdf"
  template: EmailTemplate;
}

export async function sendBiometricsEmail({
  to,
  officeName,
  pdfPaths,
  template,
}: SendEmailOptions): Promise<void> {
  const month = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  const senderName = process.env.GMAIL_FROM_NAME || 'Biometrics Department';
  const vars = { officeName, month, senderName };

  const subject = resolvePlaceholders(template.subject, vars);
  const bodyText = resolvePlaceholders(template.body, vars);

  const bodyHtml = bodyText
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #e2e8f0;margin:12px 0"/>')
    .split('\n')
    .map((line) =>
      line.trim() === ''
        ? '<br/>'
        : `<p style="margin:0 0 8px;color:#1e293b;line-height:1.7;font-size:14px;">${line}</p>`
    )
    .join('\n');

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
      <div style="background:linear-gradient(135deg,#1e3a5f 0%,#0f2744 100%);padding:32px 36px;">
        <div style="color:#f0c040;font-size:11px;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:8px;font-weight:600;">Biometrics Department</div>
        <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">${subject}</h1>
      </div>
      <div style="padding:32px 36px;">${bodyHtml}</div>
      <div style="background:#f8fafc;padding:20px 36px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">This is an automated message. Please do not reply directly to this email.</p>
      </div>
    </div>
  `;

  // Download all PDFs from Supabase storage as buffers
  const attachments = await Promise.all(
    pdfPaths.map(async (storagePath) => ({
      filename: path.basename(storagePath),
      content: await getPDFBuffer(storagePath),
      contentType: 'application/pdf',
    }))
  );

  const transporter = createTransporter();
  await transporter.sendMail({
    from: `"${senderName}" <${process.env.GMAIL_USER}>`,
    to: Array.isArray(to) ? to.join(', ') : to,
    subject,
    html,
    attachments,
  });
}

export async function verifyConnection(): Promise<boolean> {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

  