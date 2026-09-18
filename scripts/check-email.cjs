const fs = require('node:fs');
const path = require('node:path');
const Module = require('node:module');
const assert = require('node:assert/strict');
const ts = require('typescript');
const nodemailer = require('nodemailer');
const contentModule = new Module(path.resolve('lib/email-content.ts'));
contentModule._compile(ts.transpileModule(fs.readFileSync('lib/email-content.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, path.resolve('lib/email-content.ts'));
const { DEFAULT_FOOTER, DEFAULT_SECTIONS, parseSections, parseTemplateDraft, parseFooter } = contentModule.exports;
let savedFooter = DEFAULT_FOOTER;
let authorized = true;

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
  if (id === './store') return { getPDFBuffer: async () => Buffer.from('test-pdf'), getSettings: async () => ({ emailFooter: savedFooter }) };
  if (id === './email-content') return contentModule.exports;
  if (id === 'nodemailer') return {
    createTransport: () => ({ sendMail: async (options) => { captured = options; } }),
  };
  return require(id);
};
mailer._compile(compiled, filename);

function loadRoute(file) {
  const filename = path.resolve(file);
  const route = new Module(filename);
  route.paths = module.paths;
  route.require = (id) => {
    if (id === '@/lib/auth-guard') return { requireAuth: async () => ({ error: authorized ? null : new Response('Unauthorized', { status: 401 }) }) };
    if (id === '@/lib/email-content') return contentModule.exports;
    if (id === '@/lib/mailer') return mailer.exports;
    if (id === '@/lib/store') return {
      getSettings: async () => ({ emailFooter: savedFooter }),
      updateSettings: async ({ emailFooter }) => { savedFooter = emailFooter; },
    };
    return require(id);
  };
  route._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
  }).outputText, filename);
  return route.exports;
}

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
  const legacyBody = 'Daily Time Record: KEEP THIS MESSAGE ' + 'original text '.repeat(100);
  const legacy = mailer.exports.renderBiometricsEmail({ officeName: 'Office', pdfPaths: [], template: { subject: 'Legacy', body: legacyBody } });
  assert(legacy.html.includes(legacyBody));
  const sections = {
    ...DEFAULT_SECTIONS,
    action: 'Custom action **{{officeName}}**',
    reminder: 'Custom reminder <script>alert(1)</script>',
    deadlines: [{ period: '{{payPeriod}}', deadline: 'Custom deadline <b>literal</b>' }],
    acknowledgement: 'Custom acknowledgement {{senderName}}', closing: 'Custom closing',
  };
  const template = { name: 'Test', subject: '{{officeName}} - {{period}}', body: legacyBody, sections };
  savedFooter = { ...DEFAULT_FOOTER, office: 'Shared Office', address: 'Custom address\nSecond line', email: 'office@example.invalid', facebook: '<b>literal</b>' };
  const options = { officeName: 'Office <Test>', pdfPaths: ['office/report.pdf'], template };
  const preview = mailer.exports.renderBiometricsEmail({ ...options, footer: savedFooter });
  await mailer.exports.sendBiometricsEmail({ ...options, to: 'test@example.invalid' });
  assert.equal(captured.html, preview.html);
  assert.equal(captured.subject, preview.subject);
  assert(preview.html.includes('Custom action <strong>Office &lt;Test&gt;</strong>'));
  assert(preview.html.includes('Custom reminder &lt;script&gt;'));
  assert(!preview.html.includes('<script>'));
  assert(preview.html.includes('Custom deadline &lt;b&gt;literal&lt;/b&gt;'));
  assert(preview.html.includes('Custom closing'));
  assert(preview.html.includes('Custom address<br/>Second line'));
  assert(preview.html.includes('office@example.invalid'));
  assert(!preview.html.includes('18th day of the month'));
  assert(preview.html.includes('Official Facebook Account:'));
  assert(preview.html.includes('PinamalayanHRMO'));
  assert(preview.html.includes(DEFAULT_FOOTER.confidentialityNotice));
  assert(!preview.html.includes('If you received this message in error, please notify'));
  const { facebookAccount, confidentialityNotice, ...oldFooter } = savedFooter;
  const oldFooterEmail = mailer.exports.renderBiometricsEmail({ ...options, footer: oldFooter });
  assert(oldFooterEmail.html.includes('PinamalayanHRMO'));
  assert(oldFooterEmail.html.includes('office@example.invalid'));
  assert.deepEqual(parseFooter(oldFooter), savedFooter);
  const specialFooter = { ...savedFooter, facebookAccount: '<b>Account</b>', confidentialityNotice: '<script>bad()</script>\nSecond notice line' };
  const specialEmail = mailer.exports.renderBiometricsEmail({ ...options, footer: specialFooter });
  assert(specialEmail.html.includes('&lt;b&gt;Account&lt;/b&gt;'));
  assert(specialEmail.html.includes('&lt;script&gt;bad()&lt;/script&gt;<br/>Second notice line'));
  const blankFooter = { ...savedFooter, facebookAccount: '', confidentialityNotice: '' };
  const blankEmail = mailer.exports.renderBiometricsEmail({ ...options, footer: blankFooter });
  assert(!blankEmail.html.includes('Official Facebook Account:'));
  assert(!blankEmail.html.includes('CONFIDENTIALITY NOTICE'));
  assert.equal(parseFooter(blankFooter).confidentialityNotice, '');
  assert.throws(() => parseFooter({ ...savedFooter, confidentialityNotice: 42 }));
  assert.deepEqual(parseTemplateDraft(template), template);
  assert.deepEqual(parseFooter(savedFooter), savedFooter);
  assert.throws(() => parseSections({ ...sections, deadlines: 'bad' }));
  assert.throws(() => parseSections({ ...sections, action: {} }));
  assert.throws(() => parseTemplateDraft({ ...template, subject: '' }));
  assert.throws(() => parseFooter({ ...savedFooter, phone: 123 }));
  const emptyRows = mailer.exports.renderBiometricsEmail({ ...options, template: { ...template, sections: { ...sections, deadlines: [] } } });
  assert(!emptyRows.html.includes('Custom deadline'));
  const previewRoute = loadRoute('app/api/templates/preview/route.ts');
  const footerRoute = loadRoute('app/api/settings/email-footer/route.ts');
  const request = (data) => new Request('http://localhost/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });
  const response = await previewRoute.POST(request(template));
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('cache-control'), 'no-store');
  const expected = mailer.exports.renderBiometricsEmail({ template, officeName: 'Human Resource Management Office', pdfPaths: ['Office Attendance Data.pdf'], footer: savedFooter });
  assert.deepEqual(await response.json(), expected);
  assert.equal((await previewRoute.POST(request({ ...template, sections: { action: 5 } }))).status, 400);
  delete process.env.EMAIL_ASSETS_BASE_URL;
  const localPreview = await (await previewRoute.POST(request(template))).json();
  assert(localPreview.html.includes('data:image/png;base64,'));
  assert(!localPreview.html.includes('cid:'));
  savedFooter = oldFooter;
  const upgradedFooter = await (await footerRoute.GET()).json();
  assert.equal(upgradedFooter.facebookAccount, DEFAULT_FOOTER.facebookAccount);
  assert.equal(upgradedFooter.confidentialityNotice, DEFAULT_FOOTER.confidentialityNotice);
  assert.equal(upgradedFooter.email, oldFooter.email);
  const footer = { ...DEFAULT_FOOTER, phone: 'Updated phone', facebookAccount: 'Custom account', confidentialityNotice: 'Custom saved notice' };
  assert.equal((await footerRoute.PUT(request(footer))).status, 200);
  assert.deepEqual(await (await footerRoute.GET()).json(), footer);
  assert.equal((await footerRoute.PUT(request({ email: 5 }))).status, 400);
  authorized = false;
  assert.equal((await previewRoute.POST(request(template))).status, 401);
  assert.equal((await footerRoute.GET()).status, 401);
  assert.equal((await footerRoute.PUT(request(footer))).status, 401);
  console.log('PASS: shared preview/send renderer, custom sections/footer, legacy content, validation, escaping, hosted/inline attachments, preview API images, footer API round-trip and auth guards. No email sent.');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
