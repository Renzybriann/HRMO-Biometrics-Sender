import { NextRequest, NextResponse } from 'next/server';
import {
  findOfficeById,
  getOffices,
  uploadPDF,
  deletePDF,
  listPDFsWithMeta,
  getOfficePDFs,
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
    console.error('[GET /api/upload]', err);
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
    console.error('[POST /api/upload]', err);
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
    const clearOffice = searchParams.get('clearOffice'); // clear all files for one office
    const clearGlobal = searchParams.get('clearGlobal'); // clear all files for all offices

    // ── Global clear ──────────────────────────────────────────────
    if (clearGlobal === 'true') {
      const offices = await getOffices();
      let totalDeleted = 0;
      for (const office of offices) {
        const paths = await getOfficePDFs(office.name);
        for (const storagePath of paths) {
          const parts = storagePath.split('/');
          const name = parts[parts.length - 1];
          await deletePDF(office.name, name);
          totalDeleted++;
        }
      }
      return NextResponse.json({ success: true, deleted: totalDeleted });
    }

    // ── Per-office clear ──────────────────────────────────────────
    if (clearOffice === 'true') {
      if (!officeId) {
        return NextResponse.json({ error: 'officeId is required' }, { status: 400 });
      }
      const office = await findOfficeById(officeId);
      if (!office) {
        return NextResponse.json({ error: 'Office not found' }, { status: 404 });
      }
      const paths = await getOfficePDFs(office.name);
      for (const storagePath of paths) {
        const parts = storagePath.split('/');
        const name = parts[parts.length - 1];
        await deletePDF(office.name, name);
      }
      return NextResponse.json({ success: true, deleted: paths.length });
    }

    // ── Single file delete ────────────────────────────────────────
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
    console.error('[DELETE /api/upload]', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}