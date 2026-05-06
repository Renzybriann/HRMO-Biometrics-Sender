import { NextRequest, NextResponse } from 'next/server';
import {
  getSettings,
  updateSettings,
  getLogs,
  getTemplates,
  addTemplate,
  updateTemplate,
  deleteTemplate,
  generateId,
  EmailTemplate,
} from '@/lib/store';

export async function GET() {
  try {
    const [settings, logs, templates] = await Promise.all([
      getSettings(),
      getLogs(),
      getTemplates(),
    ]);
    return NextResponse.json({
      autoSendEnabled: settings.autoSendEnabled,
      activeTemplateId: settings.activeTemplateId,
      scheduler: settings.scheduler,
      scheduledOfficeIds: settings.scheduledOfficeIds, 
      logs,
      templates,
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
    const patch: Parameters<typeof updateSettings>[0] = {};

    if (typeof body.autoSendEnabled === 'boolean') patch.autoSendEnabled = body.autoSendEnabled;
    if (body.activeTemplateId) patch.activeTemplateId = body.activeTemplateId;
    if (body.scheduler) {
      const current = await getSettings();
      patch.scheduler = { ...current.scheduler, ...body.scheduler };
    }
    if (body.scheduledOfficeIds !== undefined) {         
      patch.scheduledOfficeIds = body.scheduledOfficeIds; 
    }                                                    

    await updateSettings(patch);
    const settings = await getSettings();
    const templates = await getTemplates();
    return NextResponse.json({
      autoSendEnabled: settings.autoSendEnabled,
      activeTemplateId: settings.activeTemplateId,
      scheduler: settings.scheduler,
      scheduledOfficeIds: settings.scheduledOfficeIds, 
      templates,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// POST — create new template
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, subject, body: bodyText } = body;
    if (!name || !subject || !bodyText) {
      return NextResponse.json(
        { error: 'name, subject and body required' },
        { status: 400 }
      );
    }

    const newTemplate: EmailTemplate = {
      id: generateId(),
      name: name.trim(),
      subject: subject.trim(),
      body: bodyText.trim(),
      isDefault: false,
      createdAt: new Date().toISOString(),
    };

    await addTemplate(newTemplate);
    return NextResponse.json(newTemplate, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// PUT — update existing template
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, name, subject, body: bodyText } = body;
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const updated = await updateTemplate({ id, name, subject, body: bodyText });
    return NextResponse.json(updated);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// DELETE — delete template (not default)
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const templates = await getTemplates();
    const tmpl = templates.find(t => t.id === id);
    if (!tmpl) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    if (tmpl.isDefault) {
      return NextResponse.json({ error: 'Cannot delete default template' }, { status: 400 });
    }

    await deleteTemplate(id);

    // If deleted template was active, reset to default
    const settings = await getSettings();
    if (settings.activeTemplateId === id) {
      await updateSettings({ activeTemplateId: 'default' });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}