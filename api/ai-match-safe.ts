const MODEL = process.env.OPENAI_MATCHING_MODEL || 'gpt-4.1-mini';
const OPENAI_URL = 'https://api.openai.com/v1/responses';

type JsonResponse = Record<string, unknown>;

function json(res: any, status: number, body: JsonResponse) {
  res.status(status).setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function clampScore(value: unknown): number {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function signalForScore(score: number): 'green' | 'yellow' | 'red' {
  if (score >= 95) return 'green';
  if (score >= 85) return 'yellow';
  return 'red';
}

function parseOpenAiText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text;
  const parts: string[] = [];
  for (const item of payload?.output || []) {
    for (const content of item?.content || []) {
      if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function safeText(value: unknown, max = 1000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

function safeStringArray(value: unknown, maxItems = 8, maxChars = 180): string[] {
  return Array.isArray(value)
    ? value.map((x) => safeText(x, maxChars)).filter(Boolean).slice(0, maxItems)
    : [];
}

function normalizeResult(raw: any, allowedIds: Set<string>) {
  const matches = Array.isArray(raw?.matches)
    ? raw.matches
        .map((match: any) => {
          const candidateId = safeText(match?.candidateId, 160);
          if (!allowedIds.has(candidateId)) return null;
          const score = clampScore(match?.score);
          return {
            candidateId,
            score,
            signal: signalForScore(score),
            summary: safeText(match?.summary, 500),
            reasons: safeStringArray(match?.reasons, 5, 220),
            risks: safeStringArray(match?.risks, 4, 220),
          };
        })
        .filter(Boolean)
        .sort((a: any, b: any) => b.score - a.score)
        .slice(0, 3)
    : [];

  return {
    summary: safeText(raw?.summary, 700) || 'KI-Matching wurde berechnet.',
    requirements: safeStringArray(raw?.requirements, 10, 140),
    matches,
    noMatchReason: matches.length === 0 ? safeText(raw?.noMatchReason, 500) || 'Aktuell wurde kein ausreichend passender Kandidat gefunden.' : undefined,
  };
}

function buildSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['summary', 'requirements', 'matches', 'noMatchReason'],
    properties: {
      summary: { type: 'string' },
      requirements: { type: 'array', items: { type: 'string' } },
      noMatchReason: { type: 'string' },
      matches: {
        type: 'array',
        maxItems: 3,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['candidateId', 'score', 'summary', 'reasons', 'risks'],
          properties: {
            candidateId: { type: 'string' },
            score: { type: 'integer', minimum: 0, maximum: 100 },
            summary: { type: 'string' },
            reasons: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: 'OPENAI_API_KEY fehlt in Vercel. KI-Matching bleibt deaktiviert, die App laeuft weiter.' });
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  const candidates = Array.isArray(body.candidates) ? body.candidates.slice(0, 12) : [];
  if (!candidates.length) {
    return json(res, 200, {
      summary: 'Keine Kandidaten im sichtbaren Talent-Pool.',
      requirements: [],
      matches: [],
      noMatchReason: 'Aktuell gibt es keinen Kandidatenpool fuer diese Anfrage.',
    });
  }

  const allowedIds = new Set<string>(candidates.map((c: any) => String(c.id || '')).filter(Boolean));
  const inquiry = body.inquiry || {};
  const attachments = Array.isArray(inquiry.attachments) ? inquiry.attachments.slice(0, 2) : [];
  const content: any[] = [
    {
      type: 'input_text',
      text: JSON.stringify(
        {
          ziel: 'Bewerte die externe Kundenanfrage gegen die Kandidaten und gib maximal 3 Vorschlaege zurueck.',
          scoring: '95-100 gruen/top, 85-94 gelb/moeglich, unter 85 rot/schwach. Score ehrlich berechnen, nicht kuenstlich hochziehen.',
          regeln: [
            'Nutze Anfragefelder und PDF-Inhalt als Hauptquelle.',
            'Empfiehl nur Kandidaten aus der Kandidatenliste.',
            'Wenn niemand passt, matches leer lassen und noMatchReason ausfuellen.',
            'Keine privaten Kontaktdaten erfinden.',
          ],
          inquiry: {
            contactName: safeText(inquiry.contactName, 120),
            message: safeText(inquiry.message, 6000),
            query: safeText(body.query, 24000),
            extractedPdfText: safeText(body.extractedPdfText, 18000),
            attachmentNames: Array.isArray(inquiry.attachmentNames) ? inquiry.attachmentNames : [],
          },
          candidates,
        },
        null,
        2
      ),
    },
  ];

  for (const attachment of attachments) {
    const name = safeText(attachment?.name, 160) || 'position.pdf';
    const data = safeText(attachment?.data, 2_500_000);
    if (data.startsWith('data:application/pdf;base64,')) {
      content.push({ type: 'input_file', filename: name, file_data: data });
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 22_000);
  try {
    const openAiResponse = await fetch(OPENAI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        instructions:
          'Du bist ein praeziser Recruiting-Matching-Assistent. Antworte ausschliesslich im vorgegebenen JSON-Schema. Bewertet wird fachliche Passung, Erfahrung, Standort, Verfuegbarkeit, Budget/Gehalt, Sprache, Skills und PDF-Anforderungen.',
        input: [{ role: 'user', content }],
        max_output_tokens: 1600,
        text: {
          format: {
            type: 'json_schema',
            name: 'recruiting_match_result',
            strict: true,
            schema: buildSchema(),
          },
        },
      }),
    });

    const payload = await openAiResponse.json().catch(() => null);
    if (!openAiResponse.ok) {
      return json(res, 502, { error: payload?.error?.message || 'OpenAI Matching fehlgeschlagen.' });
    }

    const text = parseOpenAiText(payload);
    const parsed = JSON.parse(text);
    return json(res, 200, normalizeResult(parsed, allowedIds));
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      return json(res, 504, { error: 'KI-Matching hat zu lange gedauert. Bitte spaeter erneut starten.' });
    }
    return json(res, 500, { error: error?.message || 'KI-Matching konnte nicht berechnet werden.' });
  } finally {
    clearTimeout(timeout);
  }
}
