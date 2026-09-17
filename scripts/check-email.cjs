const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const nodemailer = require('nodemailer');

// Exercise the mailer without loading database credentials or contacting SMTP.
const filename = path.resolve('lib/mailer.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
}).outputText;
let captured;
const mailer = new Module(filename);
mailer.filename = filename;
mailer.paths = module.paths;
mailer.require = (id) => {
  if (id === './store') return { getPDFBuffer: async () => Buffer.from('test-pdf') };
  if (id === 'nodemailer') return {
    createTransport: () => ({ sendMail: async (options) => { captured = options; } }),
  };
  return require(id);
};
mailer._compile(compiled, filename);

async function main() {
  delete process.env.EMAIL_ASSETS_BASE_URL;
  await mailer.exports.sendBiometricsEmail({
    to: 'test@example.invalid', officeName: 'Office <Test>',
    pdfPaths: ['office/report.pdf'],
    template: { subject: 'Attendance {{officeName}}', body: 'Good day!' },
  });
  assert.equal(captured.attachments.length, 7);
  assert.equal(captured.attachments[0].content.toString(), 'test-pdf');
  assert(captured.html.includes('Office &lt;Test&gt;'));
  for (const asset of captured.attachments.slice(1)) {
    assert(fs.existsSync(asset.path));
    assert(captured.html.includes(`cid:${asset.cid}`));
    assert.equal(asset.contentDisposition, 'inline');
  }
  const result = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(captured);
  const mime = result.message.toString();
  assert(mime.includes('multipart/related'));
  assert(mime.includes('application/pdf'));
  assert.equal((mime.match(/Content-ID:/g) || []).length, 6);
  process.env.EMAIL_ASSETS_BASE_URL = 'https://assets.example.invalid/email-assets/';
  await mailer.exports.sendBiometricsEmail({
    to: 'test@example.invalid', officeName: 'Office <Test>',
    pdfPaths: ['office/report.pdf'],
    template: { subject: 'Attendance', body: 'Good day!' },
  });
  assert.equal(captured.attachments.length, 1);
  assert.equal(captured.attachments[0].contentType, 'application/pdf');
  assert(!captured.html.includes('cid:'));
  for (const name of ['municipal-seal', 'attendance-illustration', 'attachment-icon', 'action-icon', 'reminder-icon', 'slogan']) {
    assert(captured.html.includes(`https://assets.example.invalid/email-assets/${name}.png`));
  }
  assert(!captured.html.includes('Biometric<br/>'));
  const hosted = await nodemailer.createTransport({ streamTransport: true, buffer: true }).sendMail(captured);
  assert(!hosted.message.toString().includes('Content-ID:'));
  assert(!hosted.message.toString().includes('Content-Type: image/'));
  console.log('PASS: hosted images with PDF-only attachments, inline fallback, escaped HTML and unbroken title. No email sent.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
