import cron from 'node-cron';
import { getOffices, getSettings, getOfficePDFs, addLog, generateId } from './store';
import { sendBiometricsEmail } from './mailer';

let schedulerStarted = false;

export async function sendToAllOffices(): Promise<{
  sent: number;
  failed: number;
}> {
  const [allOffices, { emailTemplate, autoSendEnabled }] = await Promise.all([
    getOffices(),
    getSettings(),
  ]);

  let sent = 0;
  let failed = 0;

  for (const office of allOffices) {
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
      sent++;
    } catch (err) {
      await addLog({
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

  return { sent, failed };
}

export function startScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // Runs at 8:00 AM on the 15th of every month
  cron.schedule('0 8 15 * *', async () => {
    const { autoSendEnabled } = await getSettings();
    if (!autoSendEnabled) return;
    console.log('[Scheduler] Running scheduled biometrics send...');
    const result = await sendToAllOffices();
    console.log(`[Scheduler] Done. Sent: ${result.sent}, Failed: ${result.failed}`);
  });

  console.log('[Scheduler] Biometrics scheduler started (15th of every month at 8:00 AM)');
}