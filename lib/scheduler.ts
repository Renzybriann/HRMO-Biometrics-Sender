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
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function sendToAllOffices(): Promise<{ sent: number; failed: number }> {
  const [allOffices, settings, templates] = await Promise.all([
  getOffices(),
  getSettings(),
  getTemplates(),
  ]);
  const template = await getActiveTemplate(settings, templates);

  // If scheduledOfficeIds is set and non-empty, only send to those offices
  const noneSelected = settings.scheduledOfficeIds.length === 1 && settings.scheduledOfficeIds[0] === '__none__';
  const offices = noneSelected
    ? [] // send to nobody
    : settings.scheduledOfficeIds.length > 0
      ? allOffices.filter(o => settings.scheduledOfficeIds.includes(o.id))
      : allOffices;

  let sent = 0;
  let failed = 0;
  const intervalMs = Math.max(0, settings.scheduler.sendIntervalSeconds ?? 30) * 1000;

  for (let i = 0; i < offices.length; i++) {
    const office = offices[i];
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
    } else {
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

    if (intervalMs > 0 && i < offices.length - 1) await sleep(intervalMs);
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

export async function shouldSendToday(): Promise<boolean> {
  const settings = await getSettings();
  if (!settings.autoSendEnabled || !settings.scheduler.enabled) return false;

  // Use Philippine time (UTC+8)
  const now = new Date();
  const phTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Manila' }));

  const dayMatch = phTime.getDate() === settings.scheduler.dayOfMonth;
  const hourMatch = phTime.getHours() === settings.scheduler.hour;
  const minuteMatch = phTime.getMinutes() === settings.scheduler.minute;

  console.log(`[Scheduler] PH Time: ${phTime.toLocaleString()} | Day: ${phTime.getDate()}==${settings.scheduler.dayOfMonth} | Hour: ${phTime.getHours()}==${settings.scheduler.hour} | Minute: ${phTime.getMinutes()}==${settings.scheduler.minute}`);

  return dayMatch && hourMatch && minuteMatch;
}
