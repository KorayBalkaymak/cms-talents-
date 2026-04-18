import { createClient } from '@supabase/supabase-js';

export const config = {
  maxDuration: 60,
};

type CandidateInput = {
  id: string;
  name: string;
  industry?: string;
  profession?: string | null;
  city?: string;
  country?: string;
  availability?: string;
  experienceYears?: number;
  salaryWishEur?: number | null;
  workRadiusKm?: number | null;
  workArea?: string | null;
  languages?: string | null;
  drivingLicenses?: string[];
  skills?: string[];
  boostedKeywords?: string[];
  about?: string;
};

type InquiryAttachmentInput = {
  name: string;
  data: string;
};

type AiMatchRequest = {
  inquiry: {
    id: string;
    contactName?: string;
    message?: string;
    extractedPdfText?: string;
    attachments?: InquiryAttachmentInput[];
  };
  candidates: CandidateInput[];
};

const MODEL = process.env.OPENAI_MATCHING_MODEL || 'gpt-5.4-mini';
const MAX_CANDIDATES = 60;
const MAX_PDFS = 2;
const MAX_PDF_BYTES = 6 * 1024 * 1024;

function json(res: any, status: number, body: unknown) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function dataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.includes(',') ? dataUrl.split(',').pop() || '' : dataUrl;
  return Math.floor((base64.length * 3) / 4);
}

function normalizePdfFileData(data: string): string {
  if (data.startsWith('data:application/pdf')) return data;
  const base64 = data.includes(',') ? data.split(',').pop() || '' : data;
  return `data:application/pdf;base64,${base64}`;
}

function extractOutputText(response: any): string {
  if (typeof response?.output_text === 'string') return response.output_text;
  const chunks: string[] = [];
  for (const item of response?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('\n').trim();
}

async function assertRecruiter(authHeader: string | undefined): Promise<void> {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase-Umgebung fehlt.');
  }

  const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    const err = new Error('Nicht eingeloggt.');
    (err as any).status = 401;
    throw err;
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: authData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !authData.user) {
    const err = new Error('Sitzung ungueltig.');
    (err as any).status = 401;
    throw err;
  }

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', authData.user.id)
    .maybeSingle();

  const role = profile?.role;
  if (profileError || (role !== 'recruiter' && role !== 'recruiter_admin')) {
    const err = new Error('Keine Recruiter-Berechtigung fuer KI-Matching.');
    (err as any).status = 403;
    throw err;
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  try {
    await assertRecruiter(req.headers.authorization);
  } catch (error) {
    return json(res, (error as any).status || 500, { error: (error as Error).message });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: 'OPENAI_API_KEY fehlt in Vercel. Bitte Environment Variable setzen.' });
  }

  let body: AiMatchRequest;
  try {
    body = (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {}) as AiMatchRequest;
  } catch {
    return json(res, 400, { error: 'Ungueltige Anfrage.' });
  }
  const inquiry = body.inquiry;
  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, MAX_CANDIDATES) : [];

  if (!inquiry?.id || candidates.length === 0) {
    return json(res, 400, { error: 'Anfrage oder Kandidaten fehlen.' });
  }

  const attachments = (inquiry.attachments || [])
    .filter((file) => file?.data && dataUrlBytes(file.data) <= MAX_PDF_BYTES)
    .slice(0, MAX_PDFS);

  const textPayload = {
    inquiry: {
      id: inquiry.id,
      contactName: inquiry.contactName || '',
      message: (inquiry.message || '').slice(0, 12000),
      extractedPdfText: (inquiry.extractedPdfText || '').slice(0, 20000),
      attachmentNames: attachments.map((a) => a.name),
    },
    candidates,
  };

  const content: any[] = [
    {
      type: 'input_text',
      text: JSON.stringify(textPayload),
    },
  ];

  for (const file of attachments) {
    content.push({
      type: 'input_file',
      filename: file.name || 'positionsbeschreibung.pdf',
      file_data: normalizePdfFileData(file.data),
    });
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      instructions:
        'Du bist eine Recruiting-Matching-KI fuer CMS Talents. Lies die Anfrage, ausgefuellte Felder und alle PDF-Dateien sorgfaeltig. Bewerte ausschliesslich die gelieferten Kandidaten. Erfinde niemals Kandidaten. Wenn kein Kandidat wirklich passt, gib matches leer zurueck und erklaere warum. Antworte nur im JSON-Schema.',
      input: [
        {
          role: 'user',
          content,
        },
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'cms_talent_ai_match',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              summary: { type: 'string' },
              requirements: {
                type: 'array',
                items: { type: 'string' },
              },
              matches: {
                type: 'array',
                items: {
                  type: 'object',
                  additionalProperties: false,
                  properties: {
                    candidateId: { type: 'string' },
                    score: { type: 'number' },
                    recommendation: { type: 'string', enum: ['strong', 'possible', 'weak'] },
                    why: { type: 'array', items: { type: 'string' } },
                    risks: { type: 'array', items: { type: 'string' } },
                  },
                  required: ['candidateId', 'score', 'recommendation', 'why', 'risks'],
                },
              },
              noMatchReason: { type: 'string' },
              pdfReadStatus: { type: 'string', enum: ['read', 'no_pdf', 'unreadable_or_empty'] },
            },
            required: ['summary', 'requirements', 'matches', 'noMatchReason', 'pdfReadStatus'],
          },
        },
      },
      max_output_tokens: 2200,
    }),
  });

  const result = await response.json();
  if (!response.ok) {
    return json(res, response.status, {
      error: result?.error?.message || 'OpenAI Matching fehlgeschlagen.',
    });
  }

  const outputText = extractOutputText(result);
  let parsed: any;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return json(res, 502, { error: 'OpenAI hat keine gueltige Matching-Antwort geliefert.' });
  }
  const allowedIds = new Set(candidates.map((c) => c.id));
  parsed.matches = (parsed.matches || [])
    .filter((match: any) => allowedIds.has(match.candidateId))
    .slice(0, 10);

  return json(res, 200, parsed);
}
