import { NextRequest, NextResponse } from 'next/server';
import {
  getLabels,
  addLabel,
  updateLabel,
  deleteLabel,
  generateId,
  CutoffLabel,
} from '@/lib/store';
import { requireAuth } from '@/lib/auth-guard';

export async function GET() {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const labels = await getLabels();
    return NextResponse.json(labels);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { startDate, endDate, url } = await req.json();
    if (!startDate || !endDate || !url) {
      return NextResponse.json(
        { error: 'startDate, endDate and url are required' },
        { status: 400 }
      );
    }
    const label: CutoffLabel = {
      id: generateId(),
      startDate,
      endDate,
      url: url.trim(),
      createdAt: new Date().toISOString(),
    };
    await addLabel(label);
    return NextResponse.json(label, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { id, startDate, endDate, url } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await updateLabel({ id, startDate, endDate, url });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { error: authError } = await requireAuth();
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await deleteLabel(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}