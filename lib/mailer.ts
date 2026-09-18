import nodemailer from 'nodemailer';
import path from 'path';
import { getPDFBuffer, getSettings } from './store';
import type { EmailTemplate, EmailSections, EmailFooter } from './types';
import { DEFAULT_SECTIONS, DEFAULT_FOOTER } from './email-content';

const EMAIL_ASSETS = [
  'municipal-seal', 'attendance-illustration', 'attachment-icon',
  'action-icon', 'reminder-icon', 'slogan',
] as const;

function assetImage(name: typeof EMAIL_ASSETS[number], width: number, alt: string): string {
  const baseUrl = getEmailAssetsBaseUrl();
  const src = baseUrl ? `${baseUrl}/${name}.png` : `cid:${name}@hrmo`;
  return `<img src="${escapeHtml(src)}" width="${width}" alt="${escapeHtml(alt)}" style="display:block;width:${width}px;max-width:100%;height:auto;border:0;"/>`;
}

function getEmailAssetsBaseUrl(): string | undefined {
  const value = process.env.EMAIL_ASSETS_BASE_URL?.trim();
  if (!value) return undefined;
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('EMAIL_ASSETS_BASE_URL must be an HTTPS folder URL without credentials, query parameters or a fragment.');
  }
  return url.href.replace(/\/$/, '');
}

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

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function markdownToEmailHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #dbeafe;margin:14px 0"/>')
    .split('\n')
    .map((line) =>
      line.trim() === ''
        ? ''
        : `<p style="margin:0 0 12px;color:#0b2554;line-height:1.5;font-size:14px;font-weight:400;">${line}</p>`
    )
    .join('\n');
}

function getCurrentPayPeriod() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const day = now.getDate();
  const start = new Date(year, month, day <= 15 ? 1 : 16);
  const end = day <= 15 ? new Date(year, month, 15) : new Date(year, month + 1, 0);
  const monthName = start.toLocaleString('default', { month: 'long' });
  const sameMonth = start.getMonth() === end.getMonth();
  const endMonthName = end.toLocaleString('default', { month: 'long' });
  const period = sameMonth
    ? `${monthName} ${start.getDate()}-${end.getDate()}, ${year}`
    : `${monthName} ${start.getDate()} - ${endMonthName} ${end.getDate()}, ${year}`;

  return {
    period,
    periodStart: `${monthName} ${start.getDate()}, ${year}`,
    periodEnd: `${endMonthName} ${end.getDate()}, ${year}`,
    payPeriod: start.getDate() === 1 ? '1 - 15' : '16 - 31',
    monthYear: `${monthName} ${year}`,
  };
}

function buildLogoHtml(): string {
  return assetImage('municipal-seal', 72, 'Municipality of Pinamalayan seal');
}

function buildAttachmentRows(pdfPaths: string[]): string {
  return pdfPaths.map((storagePath) => {
    const fileName = escapeHtml(path.basename(storagePath));
    return `
      <tr>
        <td style="padding:14px 0;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
            <tr>
              <td width="52" valign="middle">
                ${assetImage('attachment-icon', 44, 'Attachment')}
              </td>
              <td valign="middle">
                <div style="font-size:11px;letter-spacing:0;text-transform:uppercase;color:#2563eb;font-weight:700;margin-bottom:6px;">Attachment</div>
                <div style="font-size:15px;line-height:1.4;color:#0b2554;font-weight:700;word-break:break-word;">${fileName}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');
}

function buildEmailHtml({
  subject,
  bodyHtml,
  officeName,
  senderName,
  pdfPaths,
  period,
  sections,
  footer,
}: {
  subject: string;
  bodyHtml: string;
  officeName: string;
  senderName: string;
  pdfPaths: string[];
  period: string;
  sections: EmailSections;
  footer: EmailFooter;
}) {
  const safeSubject = escapeHtml(subject);
  const safeOfficeName = escapeHtml(officeName);

  return `
<!doctype html>
<html>
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <title>${safeSubject}</title>
    <style>
      @media screen and (max-width:600px) {
        .email-padding { padding-left:20px !important; padding-right:20px !important; }
        .email-stack { display:block !important; width:100% !important; box-sizing:border-box !important; padding-left:0 !important; padding-top:18px !important; }
        .email-heading { font-size:18px !important; }
        .email-divider { display:none !important; }
      }
    </style>
  </head>
  <body style="margin:0;padding:0;background:#f4f8ff;font-family:Arial,'Segoe UI',sans-serif;color:#0b2554;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f4f8ff;padding:24px 0;font-family:Arial,Helvetica,sans-serif;font-weight:400;letter-spacing:0;text-align:left;">
      <tr>
        <td align="center">
          <table role="presentation" width="800" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:800px;table-layout:fixed;background:#ffffff;border:1px solid #dbeafe;border-radius:8px;overflow:hidden;">
            <tr>
              <td class="email-padding" style="background:#e8f3ff;padding:24px 32px;border-bottom:1px solid #dbeafe;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="76" valign="middle">${buildLogoHtml()}</td>
                    <td valign="middle" style="padding-left:16px;">
                      <div style="font-size:13px;line-height:1.4;color:#0b3b82;font-weight:700;text-transform:uppercase;">Human Resource Management Office</div>
                      <div style="font-size:10px;line-height:1.5;color:#2563eb;font-weight:400;text-transform:uppercase;margin-top:5px;">Municipal Government of Pinamalayan</div>
                    </td>
                    <td class="email-divider" width="1" style="background:#9bbce8;"></td>
                    <td class="email-stack" width="150" valign="middle" style="padding-left:14px;">
                      <div style="font-size:11px;line-height:1.4;color:#0b3b82;font-weight:700;white-space:nowrap;">Biometric Attendance Data</div>
                      <div style="font-size:12px;line-height:1.4;color:#0b2554;margin-top:6px;">${escapeHtml(period)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-padding" style="padding:28px 36px 12px;">
                <div class="email-heading" style="font-size:26px;line-height:1.2;color:#0b2554;font-weight:700;letter-spacing:0;white-space:nowrap;">Biometric Attendance Data</div>
                <div style="font-size:20px;line-height:1.35;color:#3b82f6;font-weight:700;margin-top:8px;margin-bottom:20px;">${escapeHtml(period)}</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;">
                  <tr>
                    <td class="email-stack" width="58%" valign="top">
                      <div>
                        <p style="margin:0 0 12px;color:#0b2554;font-size:15px;line-height:1.4;font-weight:700;">Dear ${safeOfficeName},</p>
                        ${bodyHtml}
                      </div>
                    </td>
                    <td class="email-stack" width="42%" valign="top" align="center" style="padding-left:12px;padding-top:4px;">
                      ${assetImage('attendance-illustration', 300, 'Attendance records with envelope, clock and calendar')}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-padding" style="padding:16px 36px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef6ff;border-radius:14px;padding:6px 24px;">
                  ${buildAttachmentRows(pdfPaths)}
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-padding" style="padding:24px 36px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#eef6ff;border-radius:14px;">
                  <tr>
                    <td width="88" align="center" valign="top" style="padding:20px 0 20px 16px;">
                      ${assetImage('action-icon', 72, 'Action required')}
                    </td>
                    <td style="padding:22px 24px 20px 12px;">
                      <div style="font-size:12px;letter-spacing:0;text-transform:uppercase;color:#2563eb;font-weight:700;margin-bottom:10px;">Action Required</div>
                      <div style="font-size:14px;line-height:1.55;color:#0b2554;">
                        ${markdownToEmailHtml(sections.action)}
                      </div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-padding" style="padding:24px 36px 0;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="88" align="center" valign="top" style="padding:4px 12px 0 16px;">
                      ${assetImage('reminder-icon', 72, 'Submission reminder')}
                    </td>
                    <td>
                      <div style="font-size:12px;letter-spacing:0;text-transform:uppercase;color:#2563eb;font-weight:700;margin-bottom:10px;">Submission Reminder</div>
                      <div style="font-size:14px;line-height:1.55;color:#0b2554;margin-bottom:18px;">
                        ${markdownToEmailHtml(sections.reminder)}
                      </div>
                      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border:1px solid #dbeafe;border-radius:10px;overflow:hidden;">
                        <tr>
                          <td width="33%" style="background:#e8f3ff;padding:10px;font-size:12px;color:#0b3b82;font-weight:700;text-align:center;border-right:1px solid #dbeafe;">Pay Period</td>
                          <td style="background:#e8f3ff;padding:10px;font-size:12px;color:#0b3b82;font-weight:700;text-align:center;">Submission Deadline</td>
                        </tr>
                        ${sections.deadlines.map((row) => `<tr>
                          <td style="padding:12px;font-size:14px;color:#0b2554;font-weight:700;text-align:center;border-top:1px solid #dbeafe;border-right:1px solid #dbeafe;">${escapeHtml(row.period)}</td>
                          <td style="padding:12px;font-size:14px;color:#0b2554;border-top:1px solid #dbeafe;text-align:center;">${escapeHtml(row.deadline)}</td>
                        </tr>`).join('')}
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-padding" style="padding:28px 36px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td width="58" valign="top">
                      <div style="width:38px;height:38px;border-radius:50%;background:#e0e7ff;color:#4057d6;font-size:24px;line-height:38px;text-align:center;font-weight:900;">&#10003;</div>
                    </td>
                    <td>
                      <div style="font-size:14px;line-height:1.5;color:#0b2554;font-weight:400;">${markdownToEmailHtml(sections.acknowledgement)}</div>
                      <div style="font-size:12px;color:#0b3b82;font-style:italic;margin-top:6px;">${markdownToEmailHtml(sections.closing)}</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>

            <tr>
              <td class="email-padding" style="background:#e8f3ff;padding:24px 36px;border-top:1px solid #dbeafe;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
                  <tr>
                    <td class="email-stack" valign="top" style="padding-right:16px;">
                      <div style="font-size:13px;line-height:1.4;color:#0b3b82;font-weight:700;text-transform:uppercase;">${escapeHtml(footer.office)}</div>
                      <div style="font-size:12px;line-height:1.4;color:#0b2554;margin-top:4px;">${escapeHtml(footer.organization)}</div>
                      <div style="font-size:11px;line-height:1.6;color:#0b3b82;margin-top:16px;">
                        ${escapeHtml(footer.address).replace(/\n/g, '<br/>')}<br/>
                        ${escapeHtml(footer.phone)}<br/>
                        ${escapeHtml(footer.email)}
                      </div>
                    </td>
                    <td class="email-divider" width="1" style="background:#9bbce8;"></td>
                    <td class="email-stack" width="180" valign="top" align="center" style="padding-left:20px;">
                      ${assetImage('slogan', 170, 'Better Services for a Stronger Pinamalayan')}
                      <div style="font-size:11px;line-height:1.5;color:#0b3b82;margin-top:14px;">Official Facebook Page:<br/><strong>${escapeHtml(footer.facebook)}</strong></div>
                      ${footer.facebookAccount.trim() ? `<div style="font-size:11px;line-height:1.5;color:#0b3b82;margin-top:10px;overflow-wrap:break-word;">Official Facebook Account:<br/><strong>${escapeHtml(footer.facebookAccount)}</strong></div>` : ''}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
          ${footer.confidentialityNotice.trim() ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:800px;table-layout:fixed;">
            <tr><td class="email-padding" style="padding:18px 36px;font-family:Arial,Helvetica,sans-serif;font-size:11px;line-height:1.6;color:#64748b;text-align:left;overflow-wrap:break-word;">
              <div style="font-weight:700;margin-bottom:6px;">CONFIDENTIALITY NOTICE</div>
              <div style="font-style:italic;">${escapeHtml(footer.confidentialityNotice).replace(/\r?\n/g, '<br/>')}</div>
            </td></tr>
          </table>` : ''}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface SendEmailOptions {
  to: string | string[];
  officeName: string;
  pdfPaths: string[];
  template: EmailTemplate;
}

export function renderBiometricsEmail({
  officeName,
  pdfPaths,
  template,
  footer = DEFAULT_FOOTER,
}: Omit<SendEmailOptions, 'to'> & { footer?: EmailFooter }) {
  const payPeriod = getCurrentPayPeriod();
  const senderName = process.env.GMAIL_FROM_NAME || 'Biometrics Department';
  const vars = {
    officeName,
    senderName,
    month: payPeriod.monthYear,
    monthYear: payPeriod.monthYear,
    period: payPeriod.period,
    payPeriod: payPeriod.payPeriod,
    periodStart: payPeriod.periodStart,
    periodEnd: payPeriod.periodEnd,
  };

  const subject = resolvePlaceholders(template.subject, vars);
  const bodyText = resolvePlaceholders(template.body, vars);
  const bodyHtml = markdownToEmailHtml(bodyText);
  const input = template.sections ?? DEFAULT_SECTIONS;
  const sections: EmailSections = {
    action: resolvePlaceholders(input.action, vars),
    reminder: resolvePlaceholders(input.reminder, vars),
    acknowledgement: resolvePlaceholders(input.acknowledgement, vars),
    closing: resolvePlaceholders(input.closing, vars),
    deadlines: input.deadlines.map((row) => ({ period: resolvePlaceholders(row.period, vars), deadline: resolvePlaceholders(row.deadline, vars) })),
  };
  const html = buildEmailHtml({
    subject,
    bodyHtml,
    officeName,
    senderName,
    pdfPaths,
    period: payPeriod.period,
    sections,
    footer: { ...DEFAULT_FOOTER, ...footer },
  });
  return { subject, html };
}

export async function sendBiometricsEmail({ to, officeName, pdfPaths, template }: SendEmailOptions): Promise<void> {
  const settings = await getSettings();
  const { subject, html } = renderBiometricsEmail({ officeName, pdfPaths, template, footer: settings.emailFooter });
  const senderName = process.env.GMAIL_FROM_NAME || 'Biometrics Department';

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
    attachments: [
      ...attachments,
      ...(getEmailAssetsBaseUrl() ? [] : EMAIL_ASSETS.map((name) => ({
        filename: `${name}.png`,
        path: path.join(process.cwd(), 'email-assets', `${name}.png`),
        cid: `${name}@hrmo`,
        contentType: 'image/png',
        contentDisposition: 'inline' as const,
      }))),
    ],
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
