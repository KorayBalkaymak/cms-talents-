
// =====================================================
// DATABASE SCHEMA - CMS Talents
// =====================================================
// This file defines the complete data structure for the application.
// Fields marked with comments indicate REQUIRED vs OPTIONAL status.

export enum UserRole {
  CANDIDATE = 'candidate',
  RECRUITER = 'recruiter',
  ADMIN = 'recruiter_admin'
}

export enum CandidateStatus {
  ACTIVE = 'aktiv',
  BLOCKED = 'gesperrt',
  REVIEW = 'in Prüfung'
}

export interface SocialLink {
  label: string;   // REQUIRED
  url: string;     // REQUIRED
}

// =====================================================
// USER ACCOUNT (Authentication)
// =====================================================
export interface User {
  id: string;              // REQUIRED - Auto-generated UUID
  email: string;           // REQUIRED - Unique, validated format
  passwordHash: string;    // REQUIRED - SHA-256 hashed
  role: UserRole;          // REQUIRED - candidate/recruiter/admin
  createdAt: string;       // REQUIRED - ISO timestamp
  firstName?: string;      // OPTIONAL - Derived from profile
}

// =====================================================
// CANDIDATE PROFILE
// =====================================================
// All fields that are NOT optional (no ?) are REQUIRED for publishing
export interface CandidateProfile {
  // --- SYSTEM FIELDS (auto-managed) ---
  userId: string;           // REQUIRED - Links to User.id
  avatarSeed: string;       // REQUIRED - For fallback avatar
  status: CandidateStatus;  // REQUIRED - Default: REVIEW
  isPublished: boolean;     // REQUIRED - Default: false
  createdAt: string;        // REQUIRED - ISO timestamp
  updatedAt: string;        // REQUIRED - ISO timestamp

  // --- REQUIRED PERSONAL INFO ---
  firstName: string;        // REQUIRED - Pflichtfeld
  lastName: string;         // REQUIRED - Pflichtfeld
  city: string;            // REQUIRED - Pflichtfeld (Ort)
  country: string;         // REQUIRED - Pflichtfeld (Land)

  // --- PRIVATE / ADMIN ONLY INFO ---
  address?: string;        // OPTIONAL - Straße & Nr (Private)
  zipCode?: string;        // OPTIONAL - PLZ (Private)
  phoneNumber?: string;    // OPTIONAL - Telefon (Private)

  // --- REQUIRED PROFESSIONAL INFO ---
  // --- REQUIRED PROFESSIONAL INFO ---
  industry: string;         // REQUIRED - Branche
  experienceYears: number;  // REQUIRED - Jahre Erfahrung (min 0)
  availability: string;     // REQUIRED - Verfügbarkeit

  // --- OPTIONAL PERSONAL INFO ---
  birthYear?: string;       // OPTIONAL - Geburtsjahr

  // --- OPTIONAL PROFESSIONAL INFO ---
  about?: string;           // OPTIONAL - Kurz-Bio (max 500 chars)
  skills: string[];         // OPTIONAL - Array, can be empty
  boostedKeywords: string[]; // OPTIONAL - Sichtbarkeits-Booster
  isSubmitted?: boolean;     // OPTIONAL - zur Recruiter-Prüfung eingereicht
  cvReviewedAt?: string | null; // OPTIONAL - Recruiter hat CV geprüft

  // --- OPTIONAL MEDIA ---
  profileImageUrl?: string; // OPTIONAL - Base64 oder URL
  socialLinks: SocialLink[]; // OPTIONAL - Array, can be empty
  documents?: { type: string; name: string }[]; // vom Backend: Dokumenten-Infos
}

// =====================================================
// DOCUMENTS (PDFs, Images)
// =====================================================
export interface CandidateDocuments {
  userId: string;                           // REQUIRED - Links to User.id
  cvPdf?: { name: string; data: string };   // OPTIONAL - Lebenslauf
  certificates: { name: string; data: string }[]; // OPTIONAL - Zertifikate
  qualifications: { name: string; data: string }[]; // OPTIONAL - Qualifikationen
}

// =====================================================
// AUDIT LOG (Admin Actions)
// =====================================================
export interface AuditLog {
  id: string;           // REQUIRED - Auto-generated
  action: string;       // REQUIRED - Action description
  performerId: string;  // REQUIRED - Who did it
  targetId: string;     // REQUIRED - Target user
  timestamp: string;    // REQUIRED - When
}

// =====================================================
// SEARCH/MATCH RESULTS
// =====================================================
export interface MatchResult {
  candidate: CandidateProfile;
  score: number;
}

// =====================================================
// VALIDATION HELPER - Required fields for publishing
// =====================================================
export const REQUIRED_PROFILE_FIELDS = [
  'firstName',
  'lastName',
  'city',
  'country',
  'industry',
  'availability'
] as const;

// Returns list of missing required field names
export function validateProfileForPublishing(profile: CandidateProfile): string[] {
  const missing: string[] = [];

  if (!profile.firstName?.trim()) missing.push('Vorname');
  if (!profile.lastName?.trim()) missing.push('Nachname');
  if (!profile.city?.trim()) missing.push('Stadt');
  if (!profile.country?.trim()) missing.push('Land');
  if (!profile.industry?.trim()) missing.push('Branche');
  if (!profile.availability?.trim()) missing.push('Verfügbarkeit');
  if (profile.experienceYears === undefined || profile.experienceYears < 0) missing.push('Berufserfahrung');

  return missing;
}

// Check if profile is complete enough to publish
export function canPublishProfile(profile: CandidateProfile): boolean {
  return validateProfileForPublishing(profile).length === 0;
}
