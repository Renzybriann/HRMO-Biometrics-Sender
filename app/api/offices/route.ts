import { NextRequest, NextResponse } from 'next/server';
import {
  getOffices,
  addOffice,
  updateOffice,
  deleteOffice,
  findOfficeById,
  findOfficeByName,
  generateId,
  Office,
} from '@/lib/store';

export async function GET() {
  try {
    const offices = await getOffices();
    return NextResponse.json(offices);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { name, emails } = await req.json();
    if (!name || !emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'Name and at least one email are required' },
        { status: 400 }
      );
    }

    const existing = await findOfficeByName(name);
    if (existing) {
      return NextResponse.json({ error: 'Office name already exists' }, { status: 400 });
    }

    const newOffice: Office = {
      id: generateId(),
      name: name.trim(),
      emails: emails.map((e: string) => e.trim()).filter(Boolean),
      createdAt: new Date().toISOString(),
    };

    await addOffice(newOffice);
    return NextResponse.json(newOffice, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, name, emails } = await req.json();
    if (!id || !name || !emails || !Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json(
        { error: 'id, name and at least one email are required' },
        { status: 400 }
      );
    }

    const office = await findOfficeById(id);
    if (!office) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    const updated: Office = {
      ...office,
      name: name.trim(),
      emails: emails.map((e: string) => e.trim()).filter(Boolean),
    };

    await updateOffice(updated);
    return NextResponse.json(updated);
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
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const office = await findOfficeById(id);
    if (!office) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    await deleteOffice(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}