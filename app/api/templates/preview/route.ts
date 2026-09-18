import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { requireAuth } from '@/lib/auth-guard';
import { parseTemplateDraft } from '@/lib/email-content';
import { renderBiometricsEmail } from '@/lib/mailer';
import { getSettings } from '@/lib/store';

export async function POST(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  let draft;
  try { draft = parseTemplateDraft(await req.json()); }
  catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 400 }); }
  try {
    const settings = await getSettings();
    const result = renderBiometricsEmail({
      template: { ...draft, id: 'preview', isDefault: false, createdAt: '' },
      officeName: 'Human Resource Management Office', pdfPaths: ['Office Attendance Data.pdf'],
      footer: settings.emailFooter,
    });
    // Browsers cannot resolve MIME Content-IDs. Substitute only known renderer assets.
    for (const name of ['municipal-seal', 'attendance-illustration', 'attachment-icon', 'action-icon', 'reminder-icon', 'slogan']) {
      if (result.html.includes(`cid:${name}@hrmo`)) {
        const bytes = await readFile(path.join(process.cwd(), 'email-assets', `${name}.png`));
        result.html = result.html.replaceAll(`cid:${name}@hrmo`, `data:image/png;base64,${bytes.toString('base64')}`);
      }
    }
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not render the email preview' }, { status: 500 });
  }
}
