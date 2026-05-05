import { NextRequest, NextResponse } from 'next/server';
import { getSettings, getLogs, updateSettings } from '@/lib/store';

export async function GET() {
  try {
    const [settings, logs] = await Promise.all([getSettings(), getLogs()]);
    return NextResponse.json({
      autoSendEnabled: settings.autoSendEnabled,
      emailTemplate: settings.emailTemplate,
      logs,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const update: { autoSendEnabled?: boolean; emailTemplate?: any } = {};

    if (typeof body.autoSendEnabled === 'boolean')
      update.autoSendEnabled = body.autoSendEnabled;
    if (body.emailTemplate)
      update.emailTemplate = body.emailTemplate;

    await updateSettings(update);
    const settings = await getSettings();
    return NextResponse.json({
      autoSendEnabled: settings.autoSendEnabled,
      emailTemplate: settings.emailTemplate,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}