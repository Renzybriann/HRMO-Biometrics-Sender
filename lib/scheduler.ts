import cron from 'node-cron';
import {
  getOffices,
  getSettings,
  getTemplates,
  getActiveTemplate,
  getOfficePDFs,
  addLog,
  generateId,
} from './store';
import { sendBiometricsEmail } from './mailer';

let currentTask: cron.ScheduledTask | null = null;
let schedulerStarted = false;

export async function sendToAllOffices(): Promise<{ sent: number; failed: number }> {
  const [allOffices, settings, templates] = await Promise.all([
  getOffices(),
  getSettings(),
  getTemplates(),
  ]);
  const template = await getActiveTemplate(settings, templates);

  // If scheduledOfficeIds is set and non-empty, only send to those offices
  const offices = settings.scheduledOfficeIds.length > 0
    ? allOffices.filter(o => settings.scheduledOfficeIds.includes(o.id))
    : allOffices;

  let sent = 0;
  let failed = 0;

  for (const office of offices) {
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
        error: 'No PDF files found',
      });
      failed++;
      continue;
    }

    try {
      await sendBiometricsEmail({ to: office.emails, officeName: office.name, pdfPaths, template });
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

function buildCronExpression(minute: number, hour: number, dayOfMonth: number): string {
  return `${minute} ${hour} ${dayOfMonth} * *`;
}

export async function scheduleFromConfig(): Promise<void> {
  const settings = await getSettings();

  if (currentTask) {
    currentTask.stop();
    currentTask = null;
  }

  if (!settings.scheduler.enabled || !settings.autoSendEnabled) {
    console.log('[Scheduler] Disabled — not scheduling');
    return;
  }

  const { minute, hour, dayOfMonth } = settings.scheduler;
  const expr = buildCronExpression(minute, hour, dayOfMonth);
  console.log(`[Scheduler] Scheduling with cron: ${expr}`);

  currentTask = cron.schedule(expr, async () => {
    const fresh = await getSettings();
    if (!fresh.autoSendEnabled || !fresh.scheduler.enabled) return;
    console.log('[Scheduler] Running auto-send…');
    const result = await sendToAllOffices();
    console.log(`[Scheduler] Done. Sent: ${result.sent}, Failed: ${result.failed}`);
  });
}

export async function startScheduler(): Promise<void> {
  if (schedulerStarted) return;
  schedulerStarted = true;
  await scheduleFromConfig();
  console.log('[Scheduler] Started');
}