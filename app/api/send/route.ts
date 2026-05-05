import { NextRequest, NextResponse } from 'next/server';
import {
  getOffices,
  findOfficeById,
  getOfficePDFs,
  getSettings,
  addLog,
  generateId,
} from '@/lib/store';
import { sendBiometricsEmail, verifyConnection } from '@/lib/mailer';

export async function POST(req: NextRequest) {
  try {
    const ok = await verifyConnection();
    if (!ok) {
      return NextResponse.json({ error: 'SMTP connection failed' }, { status: 500 });
    }

    const body = await req.json().catch(() => ({}));
    const { officeId } = body;

    const [allOffices, { emailTemplate }] = await Promise.all([
      getOffices(),
      getSettings(),
    ]);

    const targets = officeId
      ? allOffices.filter((o) => o.id === officeId)
      : allOffices;

    if (targets.length === 0) {
      return NextResponse.json({ error: 'No offices found' }, { status: 404 });
    }

    let sent = 0;
    let failed = 0;
    const results: { office: string; status: string; error?: string }[] = [];

    for (const office of targets) {
      const pdfPaths = await getOfficePDFs(office.name);
      const emailList = office.emails.join(', ');

      if (pdfPaths.length === 0) {
        await addLog({
          id: generateId(),
          officeId: office.id,
          officeName: office.name,
          email: emailList,
          sentAt: new Date().toISOString(),
          status: 'failed',
          filesCount: 0,
          error: 'No PDF files uploaded for this office',
        });
        results.push({
          office: office.name,
          status: 'failed',
          error: 'No PDF files uploaded for this office',
        });
        failed++;
        continue;
      }

      try {
        await sendBiometricsEmail({
          to: office.emails,
          officeName: office.name,
          pdfPaths,
          template: emailTemplate,
        });

        await addLog({
          id: generateId(),
          officeId: office.id,
          officeName: office.name,
          email: emailList,
          sentAt: new Date().toISOString(),
          status: 'success',
          filesCount: pdfPaths.length,
        });
        results.push({ office: office.name, status: 'success' });
        sent++;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error';
        await addLog({
          id: generateId(),
          officeId: office.id,
          officeName: office.name,
          email: emailList,
          sentAt: new Date().toISOString(),
          status: 'failed',
          filesCount: pdfPaths.length,
          error: errorMsg,
        });
        results.push({ office: office.name, status: 'failed', error: errorMsg });
        failed++;
      }
    }

    return NextResponse.json({ sent, failed, results });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}