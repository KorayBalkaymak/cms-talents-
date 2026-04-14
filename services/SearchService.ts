import React from 'react';
import { CandidateProfile, MatchResult } from '../types';

export const normalize = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s/+.-]/gu, ' ')
    .trim();

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}

function queryTerms(query: string): string[] {
  return unique(
    normalize(query)
      .split(/\s+/)
      .filter((term) => term.length >= 2)
  );
}

function includesTerm(value: string | null | undefined, term: string): boolean {
  return !!value && normalize(value).includes(term);
}

function candidateHaystack(candidate: CandidateProfile): string[] {
  return [
    candidate.profession || '',
    candidate.industry || '',
    candidate.city || '',
    candidate.country || '',
    candidate.availability || '',
    candidate.languages || '',
    candidate.about || '',
    ...(candidate.skills || []),
    ...(candidate.boostedKeywords || []),
  ];
}

function buildMatchReasons(candidate: CandidateProfile, terms: string[]): string[] {
  const reasons: string[] = [];
  const matchedSkills = unique(
    terms.filter((term) => (candidate.skills || []).some((skill) => includesTerm(skill, term)))
  );
  if (matchedSkills.length > 0) {
    reasons.push(`Skill-Match: ${matchedSkills.slice(0, 3).join(', ')}`);
  }

  const matchedKeywords = unique(
    terms.filter((term) => (candidate.boostedKeywords || []).some((keyword) => includesTerm(keyword, term)))
  );
  if (matchedKeywords.length > 0) {
    reasons.push(`Spezialisierung passt: ${matchedKeywords.slice(0, 3).join(', ')}`);
  }

  if (terms.some((term) => includesTerm(candidate.profession, term))) {
    reasons.push(`Beruf/Profil passt zu "${candidate.profession || 'Profil'}"`);
  }

  if (terms.some((term) => includesTerm(candidate.industry, term))) {
    reasons.push(`Branchenbezug: ${candidate.industry}`);
  }

  if (terms.some((term) => includesTerm(candidate.city, term) || includesTerm(candidate.country, term))) {
    reasons.push(`Standort passt: ${[candidate.city, candidate.country].filter(Boolean).join(', ')}`);
  }

  if (terms.some((term) => includesTerm(candidate.languages, term))) {
    reasons.push(`Sprachbezug gefunden`);
  }

  if (terms.some((term) => includesTerm(candidate.availability, term))) {
    reasons.push(`Verfügbarkeit passt: ${candidate.availability}`);
  }

  if (terms.some((term) => includesTerm(candidate.about, term))) {
    reasons.push(`Beschreibung enthält relevante Begriffe`);
  }

  if (candidate.experienceYears >= 5) {
    reasons.push(`${candidate.experienceYears} Jahre Erfahrung`);
  }

  return reasons.slice(0, 4);
}

export const calculateMatchScore = (candidate: CandidateProfile, query: string): number => {
  if (!query) return 0;

  const terms = queryTerms(query);
  let score = 0;

  terms.forEach((term) => {
    if ((candidate.boostedKeywords || []).some((bk) => includesTerm(String(bk), term))) score += 5;
    if ((candidate.skills || []).some((s) => includesTerm(String(s), term))) score += 4;
    if (includesTerm(candidate.profession, term)) score += 4;
    if (includesTerm(candidate.industry, term)) score += 3;
    if (includesTerm(candidate.languages, term)) score += 2;
    if (includesTerm(candidate.city, term) || includesTerm(candidate.country, term)) score += 2;
    if (includesTerm(candidate.availability, term)) score += 2;
    if (includesTerm(candidate.about, term)) score += 1;
  });

  const normalizedQuery = normalize(query);
  if (normalizedQuery && candidateHaystack(candidate).some((value) => normalize(value).includes(normalizedQuery))) {
    score += 3;
  }

  return score;
};

export const rankCandidates = (candidates: CandidateProfile[], query: string): MatchResult[] => {
  const terms = queryTerms(query);
  return candidates
    .map((candidate) => ({
      candidate,
      score: calculateMatchScore(candidate, query),
      reasons: buildMatchReasons(candidate, terms),
    }))
    .sort((a, b) => b.score - a.score);
};

export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query) return text;
  const terms = queryTerms(query).filter((t) => t.length > 1);
  if (terms.length === 0) return text;

  const regex = new RegExp(`(${terms.map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
  const parts = text.split(regex);

  return React.createElement(
    React.Fragment,
    null,
    parts.map((part, i) =>
      regex.test(part)
        ? React.createElement('mark', { key: i, className: 'bg-orange-100 text-orange-700 rounded-sm px-0.5 font-bold' }, part)
        : part
    )
  );
};
