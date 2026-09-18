-- Additive migration: existing template bodies and subjects remain untouched.
ALTER TABLE public.templates ADD COLUMN IF NOT EXISTS sections jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS email_footer jsonb;
