-- Separate „Originale“ vs. „Bearbeitete“ Dokumente
-- Originale bleiben für Kandidaten download-only, Bearbeitete werden für den Marktplatz genutzt.

alter table public.candidate_documents
  add column if not exists edited_cv_pdf jsonb,
  add column if not exists edited_certificates jsonb not null default '[]'::jsonb,
  add column if not exists edited_qualifications jsonb not null default '[]'::jsonb;

comment on column public.candidate_documents.edited_cv_pdf is 'Vom Recruiter bearbeiteter Lebenslauf (für Marktplatz).';
comment on column public.candidate_documents.edited_certificates is 'Vom Recruiter bearbeitete Zertifikate (für Marktplatz).';
comment on column public.candidate_documents.edited_qualifications is 'Vom Recruiter bearbeitete Qualifikationen (für Marktplatz).';

