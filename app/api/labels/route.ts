import { NextRequest, NextResponse } from 'next/server';
import {
  getLabels,
  addLabel,
  updateLabel,
  deleteLabel,
  generateId,
  CutoffLabel,
} from '@/lib/store';

export async function GET() {
  try {
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
    const { name, url, year, sortOrder } = await req.json();
    if (!name || !url || !year) {
      return NextResponse.json(
        { error: 'name, url and year are required' },
        { status: 400 }
      );
    }
    const label: CutoffLabel = {
      id: generateId(),
      name: name.trim(),
      url: url.trim(),
      year: Number(year),
      sortOrder: sortOrder ?? 0,
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
    const { id, name, url, year, sortOrder } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }
    await updateLabel({ id, name, url, year: year ? Number(year) : undefined, sortOrder });
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