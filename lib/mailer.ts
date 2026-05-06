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
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;border-radius:10px;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,0.08);">
      
      <!-- Header -->
      <div style="background:linear-gradient(135deg,#f0f7ff 0%,#e0effe 100%);padding:28px 36px;border-bottom:2px solid #bfdbfe;">
        <div style="display:flex;align-items:center;gap:14px;">
          <div style="width:46px;height:46px;background:#2563eb;border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
            <div style="width:22px;height:22px;border:3px solid #fff;border-radius:50%;"></div>
          </div>
          <div>
            <div style="font-size:11px;font-weight:700;color:#2563eb;letter-spacing:0.12em;text-transform:uppercase;margin-bottom:3px;">Biometrics Department</div>
            <h1 style="margin:0;font-size:20px;font-weight:800;color:#1e3a5f;letter-spacing:-0.3px;">${subject}</h1>
          </div>
        </div>
      </div>

      <!-- Divider accent -->
      <div style="height:4px;background:linear-gradient(90deg,#2563eb,#60a5fa,#bfdbfe);"></div>

      <!-- Body -->
      <div style="padding:32px 36px;background:#ffffff;">
        ${bodyHtml}
      </div>

      <!-- Footer -->
      <div style="background:#f8fafc;padding:18px 36px;border-top:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;">
        <p style="margin:0;font-size:11px;color:#94a3b8;">This is an automated message. Please do not reply directly to this email.</p>
        <p style="margin:0;font-size:11px;color:#cbd5e1;font-weight:600;">HRMO</p>
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

  