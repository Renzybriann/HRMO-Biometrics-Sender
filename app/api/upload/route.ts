import { NextRequest, NextResponse } from 'next/server';
import {
  findOfficeById,
  getOffices,
  uploadPDF,
  deletePDF,
  listPDFsWithMeta,
} from '@/lib/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const officeId = searchParams.get('officeId');
    if (!officeId) {
      return NextResponse.json({ error: 'officeId is required' }, { status: 400 });
    }

    const office = await findOfficeById(officeId);
    if (!office) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    const files = await listPDFsWithMeta(office.name);
    return NextResponse.json({ files });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const officeId = formData.get('officeId') as string;
    const files = formData.getAll('files') as File[];

    if (!officeId || files.length === 0) {
      return NextResponse.json(
        { error: 'officeId and files are required' },
        { status: 400 }
      );
    }

    const office = await findOfficeById(officeId);
    if (!office) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    const saved: string[] = [];
    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.pdf')) continue;
      const buffer = Buffer.from(await file.arrayBuffer());
      await uploadPDF(office.name, file.name, buffer);
      saved.push(file.name);
    }

    return NextResponse.json({ saved, count: saved.length });
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
    const officeId = searchParams.get('officeId');
    const fileName = searchParams.get('file');

    if (!officeId || !fileName) {
      return NextResponse.json(
        { error: 'officeId and file are required' },
        { status: 400 }
      );
    }

    const office = await findOfficeById(officeId);
    if (!office) {
      return NextResponse.json({ error: 'Office not found' }, { status: 404 });
    }

    await deletePDF(office.name, fileName);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}