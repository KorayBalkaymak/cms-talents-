-- Optionale PDF-Unterlagen von Marktplatz-Kunden zu Interessenanfragen
alter table public.candidate_inquiries
  add column if not exists customer_attachments jsonb not null default '[]'::jsonb;

comment on column public.candidate_inquiries.customer_attachments is 'Optional customer PDFs from marketplace (max 3): [{name, data}] data URLs / base64.';
