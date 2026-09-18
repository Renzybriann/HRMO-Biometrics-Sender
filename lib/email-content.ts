import type { EmailFooter, EmailSections } from './types';

export const DEFAULT_INTRO = 'Good day!\n\nThe biometric raw attendance data for your office covering **{{period}}** is attached to this email.';

export const DEFAULT_SECTIONS: EmailSections = {
  action: 'Please download the attached attendance data and use it for the encoding and preparation of the **Daily Time Record (DTR)** of your personnel.',
  reminder: 'Please be reminded that DTRs and their required attachments must be submitted within **three (3) working days** after the end of each pay period.',
  deadlines: [
    { period: '1 - 15', deadline: '18th day of the month' },
    { period: '16 - 31', deadline: '3rd day of the following month' },
  ],
  acknowledgement: 'Kindly acknowledge receipt of this email upon receiving the attachment.',
  closing: 'Thank you very much.',
};

export const DEFAULT_FOOTER: EmailFooter = {
  office: 'Human Resource Management Office',
  organization: 'Municipal Government of Pinamalayan',
  address: 'MGP Complex, Madrid Blvd., Zone III\nPinamalayan, Oriental Mindoro 5208',
  phone: '(043) 738-9454',
  email: 'hrmo.mgop@gmail.com',
  facebook: 'HRMOPinamalayan',
  facebookAccount: 'PinamalayanHRMO',
  confidentialityNotice: 'This email, including any attachments, is intended only for the use of the addressee/s. It may contain confidential or privileged information, including personal and security information, which should not be used or disclosed without proper authorization. If you received this email in error, contact the sender immediately and permanently delete it from your system. Unless otherwise indicated, the contents of this email do not necessarily reflect the views of the sender.',
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}

function text(value: unknown, label: string, max = 10000): string {
  if (typeof value !== 'string' || value.length > max) throw new Error(`${label} must be text of at most ${max} characters`);
  return value;
}

export function parseSections(value: unknown): EmailSections {
  const input = record(value);
  if (!Array.isArray(input.deadlines) || input.deadlines.length > 12) throw new Error('Provide at most 12 deadline rows');
  return {
    action: text(input.action, 'Action'), reminder: text(input.reminder, 'Reminder'),
    acknowledgement: text(input.acknowledgement, 'Acknowledgement'), closing: text(input.closing, 'Closing'),
    deadlines: input.deadlines.map((value) => {
      const row = record(value);
      return { period: text(row.period, 'Pay period', 200), deadline: text(row.deadline, 'Deadline', 500) };
    }),
  };
}

export function parseFooter(value: unknown): EmailFooter {
  const input = record(value);
  return Object.fromEntries(Object.keys(DEFAULT_FOOTER).map((key) => {
    const fallback = key === 'facebookAccount' || key === 'confidentialityNotice' ? DEFAULT_FOOTER[key] : undefined;
    return [key, text(input[key] === undefined ? fallback : input[key], key, key === 'confidentialityNotice' ? 10000 : 1000)];
  })) as unknown as EmailFooter;
}

export function parseTemplateDraft(value: unknown) {
  const input = record(value);
  const name = text(input.name, 'Name', 200).trim();
  const subject = text(input.subject, 'Subject', 500).trim();
  const body = text(input.body, 'Introduction', 20000);
  if (!name || !subject || !body.trim()) throw new Error('Name, subject and introduction are required');
  return { name, subject, body, ...(input.sections === undefined ? {} : { sections: parseSections(input.sections) }) };
}
