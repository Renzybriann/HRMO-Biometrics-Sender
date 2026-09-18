import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { DEFAULT_FOOTER, parseFooter } from '@/lib/email-content';
import { getSettings, updateSettings } from '@/lib/store';

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;
  try {
    return NextResponse.json({ ...DEFAULT_FOOTER, ...(await getSettings()).emailFooter });
  } catch { return NextResponse.json({ error: 'Could not load footer settings' }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;
  let emailFooter;
  try { emailFooter = parseFooter(await req.json()); }
  catch (err) { return NextResponse.json({ error: (err as Error).message }, { status: 400 }); }
  try {
    await updateSettings({ emailFooter });
    return NextResponse.json(emailFooter);
  } catch { return NextResponse.json({ error: 'Could not save footer settings. Check that the email sections migration has been applied.' }, { status: 500 }); }
}
