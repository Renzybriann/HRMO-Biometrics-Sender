import { createServer } from 'http';
import { parse } from 'url';
import next from 'next';
import { startScheduler } from './lib/scheduler.js';

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  // Start the cron scheduler
  startScheduler();

  createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  }).listen(3000, () => {
    console.log('> Biometrics Dashboard ready on http://localhost:3000');
    console.log('> Scheduler active: sends on 15th of every month at 8:00 AM');
  });
});
