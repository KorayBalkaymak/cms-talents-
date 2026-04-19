import { CandidateInquiry, CandidateProfile } from '../types';

export type AiMatchSignal = 'green' | 'yellow' | 'red';

export interface AiMatchCandidate {
  candidateId: string;
  score: number;
  signal: AiMatchSignal;
  summary: string;
  reasons: string[];
  risks: string[];
}

export interface AiMatchResult {
  summary: string;
  requirements: string[];
  matches: AiMatchCandidate[];
  noMatchReason?: string;
}

interface RequestInput {
  inquiry: CandidateInquiry;
  candidates: CandidateProfile[];
  query: string;
  extractedPdfText: string;
}

const MAX_CANDIDATES_FOR_AI = 12;
const MAX_PDF_TEXT_CHARS = 18000;
const MAX_ATTACHMENT_DATA_CHARS = 2_500_000;

function safeAttachmentData(data: string): string | undefined {
  if (!data || data.length > MAX_ATTACHMENT_DATA_CHARS) return undefined;
  return data;
}

export async function createSafeAiMatch(input: RequestInput): Promise<AiMatchResult> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 25_000);
  try {
    const response = await fetch('/api/ai-match-safe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        inquiry: {
          id: input.inquiry.id,
          contactName: input.inquiry.contactName,
          message: input.inquiry.message || '',
          attachmentNames: (input.inquiry.customerAttachments || []).map((a) => a.name).filter(Boolean),
          attachments: (input.inquiry.customerAttachments || [])
            .slice(0, 2)
            .map((a) => ({ name: a.name, data: safeAttachmentData(a.data) }))
            .filter((a) => !!a.data),
        },
        query: input.query.slice(0, 24000),
        extractedPdfText: input.extractedPdfText.slice(0, MAX_PDF_TEXT_CHARS),
        candidates: input.candidates.slice(0, MAX_CANDIDATES_FOR_AI).map((candidate) => ({
          id: candidate.userId,
          candidateNumber: candidate.candidateNumber || '',
          firstName: candidate.firstName || '',
          lastName: candidate.lastName || '',
          industry: candidate.industry || '',
          profession: candidate.profession || '',
          city: candidate.city || '',
          country: candidate.country || '',
          experienceYears: candidate.experienceYears || 0,
          availability: candidate.availability || '',
          salaryWishEur: candidate.salaryWishEur ?? null,
          workRadiusKm: candidate.workRadiusKm ?? null,
          workArea: candidate.workArea || '',
          languages: candidate.languages || '',
          drivingLicenses: candidate.drivingLicenses || [],
          skills: (candidate.skills || []).slice(0, 30),
          boostedKeywords: (candidate.boostedKeywords || []).slice(0, 20),
          about: (candidate.about || '').slice(0, 1200),
        })),
      }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || 'KI-Matching konnte gerade nicht berechnet werden.');
    }
    return payload as AiMatchResult;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('KI-Matching dauert zu lange. Die App bleibt stabil, bitte später erneut starten.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
