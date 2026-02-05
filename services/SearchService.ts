
// Add React import to resolve React namespace
import React from 'react';
import { CandidateProfile, MatchResult } from '../types';

export const normalize = (text: string) => text.toLowerCase().trim();

export const calculateMatchScore = (candidate: CandidateProfile, query: string): number => {
  if (!query) return 0;
  
  const terms = normalize(query).split(/\s+/);
  let score = 0;

  terms.forEach(term => {
    // Boosted Keywords (Highest weight)
    if (candidate.boostedKeywords.some(bk => normalize(bk).includes(term))) score += 5;
    
    // Skills (Medium weight)
    if (candidate.skills.some(s => normalize(s).includes(term))) score += 3;
    
    // Industry (Medium weight)
    if (normalize(candidate.industry).includes(term)) score += 2;
    
    // About / Location (Low weight)
    if (normalize(candidate.about).includes(term)) score += 1;
    if (normalize(candidate.city).includes(term)) score += 1;
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
