
// Add React import to resolve React namespace
import React from 'react';
import { CandidateProfile, MatchResult } from '../types';

export const normalize = (text: string) => text.toLowerCase().trim();

export const calculateMatchScore = (candidate: CandidateProfile, query: string): number => {
  if (!query) return 0;

  const terms = normalize(query).split(/\s+/).filter(Boolean);
  let score = 0;

  const boosted = candidate.boostedKeywords ?? [];
  const skills = candidate.skills ?? [];

  terms.forEach((term) => {
    if (boosted.some((bk) => normalize(String(bk)).includes(term))) score += 5;
    if (skills.some((s) => normalize(String(s)).includes(term))) score += 3;
    if (normalize(candidate.industry ?? '').includes(term)) score += 2;
    if (candidate.profession && normalize(candidate.profession).includes(term)) score += 3;
    if (normalize(candidate.about ?? '').includes(term)) score += 1;
    if (candidate.languages && normalize(candidate.languages).includes(term)) score += 1;
    if (normalize(candidate.city ?? '').includes(term)) score += 1;
  });

  return score;
};

export const rankCandidates = (candidates: CandidateProfile[], query: string): MatchResult[] => {
  return candidates
    .map(c => ({ candidate: c, score: calculateMatchScore(c, query) }))
    .sort((a, b) => b.score - a.score);
};

// Fixed: Used React.createElement and React.Fragment to avoid JSX syntax errors in a .ts file
export const highlightText = (text: string, query: string): React.ReactNode => {
  if (!query) return text;
  const terms = normalize(query).split(/\s+/).filter(t => t.length > 1);
  if (terms.length === 0) return text;

  const regex = new RegExp(`(${terms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return React.createElement(
    React.Fragment,
    null,
    parts.map((part, i) => 
      regex.test(part) ? (
        React.createElement('mark', { key: i, className: "bg-orange-100 text-orange-700 rounded-sm px-0.5 font-bold" }, part)
      ) : part
    )
  );
};
