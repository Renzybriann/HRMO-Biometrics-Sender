import cron from 'node-cron';
import { readData, writeData, getOfficePDFs, generateId } from './store';
import { sendBiometricsEmail } from './mailer';

let schedulerStarted = false;

export async function sendToAllOffices(): Promise<{
  sent: number;
  failed: number;
}> {
  const data = readData();
  let sent = 0;
  let failed = 0;

  const template = data.emailTemplate;

  for (const office of data.offices) {
    const pdfPaths = getOfficePDFs(office.name);
    const emailList = office.emails.join(', ');

    if (pdfPaths.length === 0) {
      data.logs.unshift({
        id: generateId(),
        officeId: office.id,
        officeName: office.name,
        email: emailList,
        sentAt: new Date().toISOString(),
        status: 'failed',
        filesCount: 0,
        error: 'No PDF files found for this office',
      });
      failed++;
      continue;
    }

    try {
      await sendBiometricsEmail({
        to: office.emails,
        officeName: office.name,
        pdfPaths,
        template,
      });

      data.logs.unshift({
        id: generateId(),
        officeId: office.id,
        officeName: office.name,
        email: emailList,
        sentAt: new Date().toISOString(),
        status: 'success',
        filesCount: pdfPaths.length,
      });
      sent++;
    } catch (err) {
      data.logs.unshift({
        id: generateId(),
        officeId: office.id,
        officeName: office.name,
        email: emailList,
        sentAt: new Date().toISOString(),
        status: 'failed',
        filesCount: pdfPaths.length,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      failed++;
    }
  }

  // Keep only last 100 logs
  data.logs = data.logs.slice(0, 100);
  writeData(data);

  return { sent, failed };
}

export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Runs at 8:00 AM on the 15th of every month
  cron.schedule('0 8 15 * *', async () => {
    const data = readData();
    if (!data.autoSendEnabled) return;
    console.log('[Scheduler] Running scheduled biometrics send...');
    const result = await sendToAllOffices();
    console.log(`[Scheduler] Done. Sent: ${result.sent}, Failed: ${result.failed}`);
  });

  console.log('[Scheduler] Biometrics scheduler started (15th of every month at 8:00 AM)');
}