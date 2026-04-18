import { CandidateInquiry, CandidateProfile } from '../types';
import { supabase } from '../utils/supabase';

export type AiMatchRecommendation = {
  candidateId: string;
  score: number;
  recommendation: 'strong' | 'possible' | 'weak';
  why: string[];
  risks: string[];
};

export type AiMatchResult = {
  summary: string;
  requirements: string[];
  matches: AiMatchRecommendation[];
  noMatchReason: string;
  pdfReadStatus: 'read' | 'no_pdf' | 'unreadable_or_empty';
};

type RequestInput = {
  inquiry: CandidateInquiry;
  candidates: CandidateProfile[];
  extractedPdfText?: string;
};

function candidateName(candidate: CandidateProfile): string {
  return `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim() || candidate.candidateNumber || candidate.userId;
}

function compactCandidate(candidate: CandidateProfile) {
  return {
    id: candidate.userId,
    name: candidateName(candidate),
    industry: candidate.industry || '',
    profession: candidate.profession || '',
    city: candidate.city || '',
    country: candidate.country || '',
    availability: candidate.availability || '',
    experienceYears: candidate.experienceYears || 0,
    salaryWishEur: candidate.salaryWishEur ?? null,
    workRadiusKm: candidate.workRadiusKm ?? null,
    workArea: candidate.workArea ?? null,
    languages: candidate.languages || '',
    drivingLicenses: candidate.drivingLicenses || [],
    skills: candidate.skills || [],
    boostedKeywords: candidate.boostedKeywords || [],
    about: (candidate.about || '').slice(0, 3000),
  };
}

export async function createAiMatch(input: RequestInput): Promise<AiMatchResult> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new Error('Bitte neu einloggen, damit KI-Matching gestartet werden kann.');
  }

  const response = await fetch('/api/ai-match', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inquiry: {
        id: input.inquiry.id,
        contactName: input.inquiry.contactName,
        message: input.inquiry.message || '',
        extractedPdfText: input.extractedPdfText || '',
        attachments: (input.inquiry.customerAttachments || []).slice(0, 2),
      },
      candidates: input.candidates.slice(0, 60).map(compactCandidate),
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.error || 'KI-Matching konnte nicht ausgeführt werden.');
  }
  return payload as AiMatchResult;
}
