# Designed email templates

## Database setup

Before saving section or footer edits, run
`supabase/migrations/202609170001_email_sections.sql` in the Supabase SQL Editor
for each environment. It adds nullable JSONB columns to `templates` and `settings`.
It does not modify existing bodies, subjects, or settings values.

Deploy the updated application after applying the migration. Keep
`EMAIL_ASSETS_BASE_URL` configured on the server to send images by public URL,
with only PDFs as attachments. Without it, the existing inline image fallback applies.

## Editing and previewing

- Templates controls the subject, introduction, action text, reminder, deadline rows,
  acknowledgement, and closing. New subjects use `{{period}}`.
- Existing bodies are preserved as the introduction, without keyword or length-based
  replacement. Review old full-message bodies for duplicated reminders or signatures;
  move that wording to the corresponding fields explicitly. Fixed dates in existing
  subjects also remain unchanged until edited.
- Admin > Shared Email Footer controls contact details for all templates.
  It includes separate Facebook Page and Facebook Account fields, plus the full
  Confidentiality Notice. Older saved footers inherit the default account and notice
  while retaining their existing contact details. Saving stores the new fields in
  the existing JSONB column; no additional migration is required. Empty account or
  notice fields omit those blocks from the email.
- Preview renders the unsaved draft through the same function as sending, using a
  sample office and PDF filename, the current pay period, and the saved shared footer.
  The preview does not save changes or send mail. Its mobile selector uses a 375px frame.
- Text is escaped before supported bold/italic formatting is applied. The preview is
  displayed in a sandboxed iframe; it cannot run scripts.

The HTML layout, artwork, and branding remain shared. A browser preview is not a
guarantee of identical rendering in all email clients; test the final message in Gmail.

## Local verification

Run `node scripts/check-email.cjs` and
`node node_modules/typescript/bin/tsc --noEmit --incremental false`.
The email checks use a mocked database and in-memory mail transport, so they do
not contact recipients or verify the remote database migration.
