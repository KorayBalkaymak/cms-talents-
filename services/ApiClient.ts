import { supabase } from '../utils/supabase';
import {
  AuditLog,
  CandidateDocuments,
  CandidateDocumentsForRecruiter,
  CandidateInquiry,
  CandidateProfile,
  CandidateStatus,
  InquiryCustomerAttachment,
  isRecruiterEditingClaimStale,
  RegisteredUserListItem,
  SocialLink,
  User,
  UserRole,
} from '../types';

const SESSION_KEY = 'cms_talents_session';
const LOCAL_INQUIRIES_KEY = 'cms_talents_local_inquiries';
const LOCAL_EXTERNAL_CANDIDATES_KEY = 'cms_talents_local_external_candidates';
const LOCAL_EDITED_DOCS_KEY = 'cms_talents_local_edited_documents';
const LOCAL_ORIGINAL_DOCS_KEY = 'cms_talents_local_original_documents';
const EDITING_CLAIM_SET_PREFIX = 'editing_claim:set:';
const EDITING_CLAIM_CLEAR = 'editing_claim:clear';

const RECRUITER_ROLE_BY_EMAIL: Record<string, UserRole> = {
  'haagen@industries-cms.com': UserRole.ADMIN,
  'hagen@industries-cms.com': UserRole.RECRUITER,
  'candau@industries-cms.com': UserRole.RECRUITER,
  'fuhrmann@industries-cms.com': UserRole.RECRUITER,
};

export const RECRUITER_EMAILS = Object.keys(RECRUITER_ROLE_BY_EMAIL);

export function isRecruiterEmail(email: string): boolean {
  return !!RECRUITER_ROLE_BY_EMAIL[email.trim().toLowerCase()];
}

type ProfileRow = {
  id: string;
  email: string;
  role: UserRole;
  first_name: string;
  last_name: string;
  city: string;
  country: string;
  address: string | null;
  zip_code: string | null;
  phone_number: string | null;
  industry: string;
  profession: string | null;
  experience_years: number;
  availability: string;
  birth_year: string | null;
  about: string | null;
  languages: string | null;
  profile_image_url: string | null;
  avatar_seed: string;
  salary_wish_eur: number | null;
  work_radius_km: number | null;
  work_area: string | null;
  status: CandidateStatus;
  is_published: boolean;
  is_submitted: boolean;
  cv_reviewed_at: string | null;
  cv_reviewed_by: string | null;
  skills: string[] | null;
  boosted_keywords: string[] | null;
  social_links: SocialLink[] | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  candidate_number?: string | null;
  recruiter_editing_user_id?: string | null;
  recruiter_editing_label?: string | null;
  recruiter_editing_at?: string | null;
};

type DocumentRow = {
  user_id: string;
  cv_pdf: { name: string; data: string } | null;
  certificates: { name: string; data: string }[] | null;
  qualifications: { name: string; data: string }[] | null;
  edited_cv_pdf: { name: string; data: string } | null;
  edited_certificates: { name: string; data: string }[] | null;
  edited_qualifications: { name: string; data: string }[] | null;
  updated_at: string | null;
};

type InquiryRow = {
  id: string;
  candidate_user_id: string | null;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  message: string | null;
  customer_attachments?: unknown;
  created_at: string;
  recruiter_editing_user_id?: string | null;
  recruiter_editing_label?: string | null;
  recruiter_editing_at?: string | null;
};

type ExternalCandidateRow = {
  id: string;
  candidate_number: string | null;
  first_name?: string | null;
  last_name?: string | null;
  city: string;
  country: string;
  industry: string;
  profession?: string | null;
  experience_years: number;
  availability: string;
  salary_wish_eur: number | null;
  about: string | null;
  languages?: string | null;
  skills: string[] | null;
  boosted_keywords: string[] | null;
  cv_pdf: { name: string; data: string } | null;
  certificates: { name: string; data: string }[] | null;
  qualifications: { name: string; data: string }[] | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
  work_radius_km?: number | null;
  work_area?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function formatAuthError(message?: string): string {
  const text = (message || '').toLowerCase();
  if (text.includes('invalid login credentials')) return 'Ungültige Anmeldedaten';
  if (text.includes('email not confirmed')) return 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.';
  if (text.includes('user already registered')) return 'Diese E-Mail ist bereits registriert.';
  if (text.includes('password should be at least')) return 'Passwort muss mindestens 8 Zeichen haben.';
  if (text.includes('signup is disabled')) return 'Registrierung ist derzeit deaktiviert.';
  return message || 'Anfrage fehlgeschlagen';
}

function isRecruiterRole(role?: string | null): boolean {
  return role === UserRole.RECRUITER || role === UserRole.ADMIN;
}

export function recruiterRoleFromEmail(email?: string | null): UserRole {
  if (!email) return UserRole.CANDIDATE;
  return RECRUITER_ROLE_BY_EMAIL[normalizeEmail(email)] || UserRole.CANDIDATE;
}

function recruiterClaimLabelFromUser(u: User): string {
  const fn = u.firstName?.trim();
  if (fn) return fn;
  const local = (u.email || '').split('@')[0] || 'Recruiter';
  return local.charAt(0).toUpperCase() + local.slice(1).toLowerCase();
}

function isRecruiterEditingSchemaMissing(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return (
    text.includes("could not find the 'recruiter_editing_at' column") ||
    text.includes("could not find the 'recruiter_editing_user_id' column") ||
    text.includes("could not find the 'recruiter_editing_label' column")
  );
}

function isCandidateNumberSchemaMissing(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return text.includes("could not find the 'candidate_number' column");
}

function isProfileSalaryWorkSchemaMissing(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return (
    text.includes("could not find the 'salary_wish_eur' column") ||
    text.includes("could not find the 'work_radius_km' column") ||
    text.includes("could not find the 'work_area' column") ||
    text.includes("could not find the 'profession' column")
  );
}

function isProfileLanguagesSchemaMissing(message?: string): boolean {
  return (message || '').toLowerCase().includes("could not find the 'languages' column");
}

function isExternalCandidatesNamesSchemaMissing(message?: string): boolean {
  const t = (message || '').toLowerCase();
  return t.includes("could not find the 'first_name' column") || t.includes("could not find the 'last_name' column");
}

function isExternalCandidatesProfessionSchemaMissing(message?: string): boolean {
  return (message || '').toLowerCase().includes("could not find the 'profession' column");
}

function isExternalCandidatesWorkFieldsSchemaMissing(message?: string): boolean {
  const t = (message || '').toLowerCase();
  return t.includes("work_radius_km") || t.includes("work_area");
}

function isCandidateInquiriesSchemaMissing(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return (
    text.includes("could not find the table 'public.candidate_inquiries'") ||
    text.includes("relation \"public.candidate_inquiries\" does not exist") ||
    text.includes("relation \"candidate_inquiries\" does not exist")
  );
}

function isCustomerAttachmentsColumnMissing(message?: string): boolean {
  const m = (message || '').toLowerCase();
  return m.includes('customer_attachments') && (m.includes('column') || m.includes('schema'));
}

function isEditedDocumentsSchemaMissing(message?: string): boolean {
  const m = (message || '').toLowerCase();
  return (
    (m.includes('edited_cv_pdf') ||
      m.includes('edited_certificates') ||
      m.includes('edited_qualifications')) &&
    (m.includes('column') || m.includes('schema cache'))
  );
}

class ApiClient {
  private readonly legacyProfessionPrefix = '[profession]:';
  private readonly legacySalaryPrefix = '[salary]:';
  private readonly legacyRadiusPrefix = '[radius]:';

  private extractLegacyProfileFields(
    profession: string | null | undefined,
    salaryWishEur: number | null | undefined,
    workRadiusKm: number | null | undefined,
    about: string | null | undefined
  ): { profession: string | null; salaryWishEur: number | null; workRadiusKm: number | null; about: string | null } {
    const normalizedProfession = profession?.trim() || '';
    const normalizedSalary = salaryWishEur ?? null;
    const normalizedRadius = workRadiusKm ?? null;
    const lines = (about || '').split('\n');
    const bodyLines: string[] = [];
    let legacyProfession: string | null = null;
    let legacySalary: number | null = null;
    let legacyRadius: number | null = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (line.startsWith(this.legacyProfessionPrefix)) {
        const decoded = decodeURIComponent(line.slice(this.legacyProfessionPrefix.length) || '').trim();
        legacyProfession = decoded || legacyProfession;
        continue;
      }
      if (line.startsWith(this.legacySalaryPrefix)) {
        const num = Number(line.slice(this.legacySalaryPrefix.length));
        if (Number.isFinite(num)) legacySalary = Math.max(0, Math.round(num));
        continue;
      }
      if (line.startsWith(this.legacyRadiusPrefix)) {
        const num = Number(line.slice(this.legacyRadiusPrefix.length));
        if (Number.isFinite(num)) legacyRadius = Math.max(0, Math.round(num));
        continue;
      }
      bodyLines.push(raw);
    }

    return {
      profession: normalizedProfession || legacyProfession,
      salaryWishEur: normalizedSalary ?? legacySalary,
      workRadiusKm: normalizedRadius ?? legacyRadius,
      about: bodyLines.join('\n').trim() || null,
    };
  }

  private withLegacyProfileFieldsInAbout(
    profession: string | null | undefined,
    salaryWishEur: number | null | undefined,
    workRadiusKm: number | null | undefined,
    about: string | null | undefined
  ): string | null {
    const extracted = this.extractLegacyProfileFields(null, null, null, about || null);
    const p = (profession || '').trim();
    const s = salaryWishEur ?? null;
    const r = workRadiusKm ?? null;
    const headers: string[] = [];
    if (p) headers.push(`${this.legacyProfessionPrefix}${encodeURIComponent(p)}`);
    if (s !== null && s !== undefined && Number.isFinite(Number(s))) headers.push(`${this.legacySalaryPrefix}${Math.max(0, Math.round(Number(s)))}`);
    if (r !== null && r !== undefined && Number.isFinite(Number(r))) headers.push(`${this.legacyRadiusPrefix}${Math.max(0, Math.round(Number(r)))}`);
    const cleanAbout = extracted.about;
    if (headers.length === 0) return cleanAbout || null;
    return cleanAbout ? `${headers.join('\n')}\n${cleanAbout}` : headers.join('\n');
  }

  private toMarketplaceCodename(c: CandidateProfile): CandidateProfile {
    const code = c.candidateNumber || `KT-${c.userId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase()}`;
    return {
      ...c,
      firstName: 'Talent',
      lastName: code,
    };
  }

  private externalRowToCandidate(row: ExternalCandidateRow): CandidateProfile {
    const number = row.candidate_number || `EXT-${row.id.slice(0, 8).toUpperCase()}`;
    const fn = (row.first_name || '').trim();
    const ln = (row.last_name || '').trim();
    return {
      userId: `external:${row.id}`,
      avatarSeed: number,
      status: CandidateStatus.ACTIVE,
      isPublished: !!row.is_published,
      isSubmitted: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      candidateNumber: number,
      firstName: fn || 'Extern',
      lastName: ln || number,
      city: row.city || '',
      country: row.country || '',
      industry: row.industry || '',
      profession: row.profession ?? null,
      experienceYears: row.experience_years || 0,
      availability: row.availability || '',
      salaryWishEur: row.salary_wish_eur ?? null,
      workRadiusKm: row.work_radius_km ?? null,
      workArea: row.work_area ?? null,
      about: row.about || undefined,
      languages: row.languages?.trim() || null,
      skills: row.skills || [],
      boostedKeywords: row.boosted_keywords || [],
      socialLinks: [],
      documents: [
        ...(row.cv_pdf?.name ? [{ type: 'cv', name: row.cv_pdf.name }] : []),
        ...((row.certificates || []).filter((d) => !!d?.name).map((d) => ({ type: 'certificate', name: d.name }))),
        ...((row.qualifications || []).filter((d) => !!d?.name).map((d) => ({ type: 'qualification', name: d.name }))),
      ],
    };
  }

  private readLocalExternalCandidates(): CandidateProfile[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_EXTERNAL_CANDIDATES_KEY);
      return raw ? ((JSON.parse(raw) as CandidateProfile[]) || []) : [];
    } catch {
      return [];
    }
  }

  private writeLocalExternalCandidates(list: CandidateProfile[]): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(LOCAL_EXTERNAL_CANDIDATES_KEY, JSON.stringify(list.slice(0, 300)));
    } catch {
      // ignore local storage errors
    }
  }

  private async loadExternalCandidatesRemote(): Promise<CandidateProfile[] | null> {
    const { data, error } = await supabase
      .from('external_candidates')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(300);
    if (error || !data) return null;
    return (data as ExternalCandidateRow[]).map((r) => this.externalRowToCandidate(r));
  }

  private mergeUniqueCandidates(primary: CandidateProfile[], extra: CandidateProfile[]): CandidateProfile[] {
    const map = new Map<string, CandidateProfile>();
    for (const c of primary) map.set(c.userId, c);
    for (const c of extra) map.set(c.userId, c);
    return Array.from(map.values());
  }
  private async readEditingClaimsFromAudit(candidateUserIds: string[]): Promise<Map<string, { userId: string; label: string; at: string } | null>> {
    const ids = Array.from(new Set(candidateUserIds.filter(Boolean)));
    if (!ids.length) return new Map();
    const { data, error } = await supabase
      .from('audit_log')
      .select('action,target_id,timestamp')
      .in('target_id', ids)
      .order('timestamp', { ascending: false })
      .limit(2000);
    if (error || !data) return new Map();

    const claims = new Map<string, { userId: string; label: string; at: string } | null>();
    for (const row of data as Array<{ action: string; target_id: string; timestamp: string }>) {
      if (claims.has(row.target_id)) continue;
      const action = row.action || '';
      if (action.startsWith(EDITING_CLAIM_SET_PREFIX)) {
        const rest = action.slice(EDITING_CLAIM_SET_PREFIX.length);
        const [userId, encodedLabel] = rest.split(':');
        claims.set(row.target_id, {
          userId: userId || '',
          label: decodeURIComponent(encodedLabel || 'Recruiter'),
          at: row.timestamp,
        });
      } else if (action === EDITING_CLAIM_CLEAR) {
        claims.set(row.target_id, null);
      }
    }
    return claims;
  }

  private mergeAuditEditingClaim(
    c: CandidateProfile,
    claim: { userId: string; label: string; at: string } | null | undefined
  ): CandidateProfile {
    const hasDbClaim =
      !!c.recruiterEditingUserId &&
      !!c.recruiterEditingLabel &&
      !!c.recruiterEditingAt &&
      !isRecruiterEditingClaimStale(c.recruiterEditingAt);
    if (hasDbClaim || !claim) return c;
    return {
      ...c,
      recruiterEditingUserId: claim.userId,
      recruiterEditingLabel: claim.label,
      recruiterEditingAt: claim.at,
    };
  }

  private pushLocalInquiry(input: {
    candidateUserId: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    message?: string;
    customerAttachments?: InquiryCustomerAttachment[];
  }): void {
    if (typeof window === 'undefined') return;
    const attachments = this.normalizeInquiryCustomerAttachments(input.customerAttachments);
    const next: CandidateInquiry = {
      id: `local-${crypto.randomUUID()}`,
      candidateUserId: input.candidateUserId ?? null,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      contactPhone: input.contactPhone.trim(),
      message: input.message?.trim() || undefined,
      customerAttachments: attachments.length ? attachments : undefined,
      createdAt: new Date().toISOString(),
    };
    try {
      const raw = window.localStorage.getItem(LOCAL_INQUIRIES_KEY);
      const parsed = raw ? (JSON.parse(raw) as CandidateInquiry[]) : [];
      window.localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify([next, ...parsed].slice(0, 300)));
    } catch {
      // ignore local fallback errors
    }
  }

  private readLocalInquiries(): CandidateInquiry[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(LOCAL_INQUIRIES_KEY);
      return raw ? ((JSON.parse(raw) as CandidateInquiry[]) || []) : [];
    } catch {
      return [];
    }
  }

  private readLocalEditedDocumentsMap(): Record<string, CandidateDocuments> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_EDITED_DOCS_KEY);
      return raw ? ((JSON.parse(raw) as Record<string, CandidateDocuments>) || {}) : {};
    } catch {
      return {};
    }
  }

  private writeLocalEditedDocumentsMap(next: Record<string, CandidateDocuments>): void {
    if (typeof window === 'undefined') return;
    try {
      const entries = Object.entries(next).slice(0, 300);
      window.localStorage.setItem(LOCAL_EDITED_DOCS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // ignore local fallback errors
    }
  }

  private readLocalEditedDocuments(userId: string): CandidateDocuments | undefined {
    const map = this.readLocalEditedDocumentsMap();
    const doc = map[userId];
    if (!doc) return undefined;
    return {
      userId,
      cvPdf: doc.cvPdf || undefined,
      certificates: doc.certificates || [],
      qualifications: doc.qualifications || [],
    };
  }

  private writeLocalEditedDocuments(userId: string, data: CandidateDocuments): void {
    const map = this.readLocalEditedDocumentsMap();
    map[userId] = {
      userId,
      cvPdf: data.cvPdf || undefined,
      certificates: data.certificates || [],
      qualifications: data.qualifications || [],
    };
    this.writeLocalEditedDocumentsMap(map);
  }

  private readLocalOriginalDocumentsMap(): Record<string, CandidateDocuments> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = window.localStorage.getItem(LOCAL_ORIGINAL_DOCS_KEY);
      return raw ? ((JSON.parse(raw) as Record<string, CandidateDocuments>) || {}) : {};
    } catch {
      return {};
    }
  }

  private writeLocalOriginalDocumentsMap(next: Record<string, CandidateDocuments>): void {
    if (typeof window === 'undefined') return;
    try {
      const entries = Object.entries(next).slice(0, 300);
      window.localStorage.setItem(LOCAL_ORIGINAL_DOCS_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch {
      // ignore local fallback errors
    }
  }

  private readLocalOriginalDocuments(userId: string): CandidateDocuments | undefined {
    const map = this.readLocalOriginalDocumentsMap();
    const doc = map[userId];
    if (!doc) return undefined;
    return {
      userId,
      cvPdf: doc.cvPdf || undefined,
      certificates: doc.certificates || [],
      qualifications: doc.qualifications || [],
    };
  }

  private writeLocalOriginalDocumentsIfMissing(userId: string, data: CandidateDocuments): void {
    const map = this.readLocalOriginalDocumentsMap();
    if (map[userId]) return;
    map[userId] = {
      userId,
      cvPdf: data.cvPdf || undefined,
      certificates: data.certificates || [],
      qualifications: data.qualifications || [],
    };
    this.writeLocalOriginalDocumentsMap(map);
  }

  private fallbackCandidateNumber(userId: string): string {
    return `KT-${userId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
  }

  private async generateCandidateNumber(): Promise<string> {
    for (let i = 0; i < 8; i++) {
      const candidateNumber = `KT-${crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()}`;
      const { data, error } = await supabase
        .from('profiles')
        .select('id')
        .eq('candidate_number', candidateNumber)
        .limit(1);
      if (!error && (!data || data.length === 0)) {
        return candidateNumber;
      }
    }
    return `KT-${Date.now().toString(36).toUpperCase()}`;
  }

  private async currentAuthUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return null;
    }
    return data.user ?? null;
  }

  private async fetchProfileRow(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return (data as ProfileRow | null) ?? null;
  }

  private async fetchDocumentRow(userId: string): Promise<DocumentRow | null> {
    const { data, error } = await supabase
      .from('candidate_documents')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return null;
    }

    return (data as DocumentRow | null) ?? null;
  }

  private documentsToList(
    row: DocumentRow | null | undefined,
    useEdited: boolean
  ): { type: string; name: string }[] {
    if (!row) return [];

    const items: { type: string; name: string }[] = [];
    if (!useEdited) {
      if (row.cv_pdf?.name) items.push({ type: 'cv', name: row.cv_pdf.name });
      for (const cert of row.certificates || []) {
        if (cert?.name) items.push({ type: 'certificate', name: cert.name });
      }
      for (const qual of row.qualifications || []) {
        if (qual?.name) items.push({ type: 'qualification', name: qual.name });
      }
      return items;
    }

    const hasEditedColumns =
      Object.prototype.hasOwnProperty.call(row as object, 'edited_cv_pdf') ||
      Object.prototype.hasOwnProperty.call(row as object, 'edited_certificates') ||
      Object.prototype.hasOwnProperty.call(row as object, 'edited_qualifications');
    if (!hasEditedColumns) {
      // DB ohne edited_* Spalten: für Marktplatz auf Standard-Dokumentspalten zurückfallen.
      if (row.cv_pdf?.name) items.push({ type: 'cv', name: row.cv_pdf.name });
      for (const cert of row.certificates || []) {
        if (cert?.name) items.push({ type: 'certificate', name: cert.name });
      }
      for (const qual of row.qualifications || []) {
        if (qual?.name) items.push({ type: 'qualification', name: qual.name });
      }
      return items;
    }

    // edited docs for marktplatz
    if (row.edited_cv_pdf?.name) items.push({ type: 'cv', name: row.edited_cv_pdf.name });
    for (const cert of row.edited_certificates || []) {
      if (cert?.name) items.push({ type: 'certificate', name: cert.name });
    }
    for (const qual of row.edited_qualifications || []) {
      if (qual?.name) items.push({ type: 'qualification', name: qual.name });
    }
    return items;
  }

  private documentRowToDocuments(
    row: DocumentRow | null | undefined,
    useEdited: boolean
  ): CandidateDocuments {
    const source = useEdited
      ? {
          cv_pdf: row?.edited_cv_pdf ?? null,
          certificates: row?.edited_certificates ?? [],
          qualifications: row?.edited_qualifications ?? [],
        }
      : {
          cv_pdf: row?.cv_pdf ?? null,
          certificates: row?.certificates ?? [],
          qualifications: row?.qualifications ?? [],
        };

    return {
      userId: row?.user_id || '',
      cvPdf: source.cv_pdf || undefined,
      certificates: source.certificates || [],
      qualifications: source.qualifications || [],
    };
  }

  private parseInquiryCustomerAttachments(raw: unknown): InquiryCustomerAttachment[] | undefined {
    if (raw == null) return undefined;
    if (!Array.isArray(raw)) return undefined;
    const out: InquiryCustomerAttachment[] = [];
    for (const item of raw) {
      if (typeof item !== 'object' || !item) continue;
      const name = (item as { name?: unknown }).name;
      const data = (item as { data?: unknown }).data;
      if (typeof name !== 'string' || typeof data !== 'string') continue;
      const n = name.trim().slice(0, 255);
      const d = data.trim();
      if (!n || !d) continue;
      out.push({ name: n, data: d });
      if (out.length >= 2) break;
    }
    return out.length ? out : undefined;
  }

  private normalizeInquiryCustomerAttachments(
    input?: InquiryCustomerAttachment[]
  ): InquiryCustomerAttachment[] {
    if (!input?.length) return [];
    const out: InquiryCustomerAttachment[] = [];
    for (const a of input.slice(0, 2)) {
      const name = (a.name || 'document.pdf').trim().slice(0, 255);
      const data = (a.data || '').trim();
      if (!name || !data) continue;
      out.push({ name, data });
      if (out.length >= 2) break;
    }
    return out;
  }

  private inquiryRowToInquiry(row: InquiryRow): CandidateInquiry {
    return {
      id: row.id,
      candidateUserId: row.candidate_user_id ?? null,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      message: row.message || undefined,
      customerAttachments: this.parseInquiryCustomerAttachments(row.customer_attachments),
      createdAt: row.created_at,
      recruiterEditingUserId: row.recruiter_editing_user_id ?? null,
      recruiterEditingLabel: row.recruiter_editing_label ?? null,
      recruiterEditingAt: row.recruiter_editing_at ?? null,
    };
  }

  private profileRowToCandidate(row: ProfileRow, docs?: DocumentRow | null): CandidateProfile {
    const normalized = this.extractLegacyProfileFields(
      row.profession ?? null,
      row.salary_wish_eur ?? null,
      row.work_radius_km ?? null,
      row.about ?? null
    );
    return {
      userId: row.id,
      avatarSeed: row.avatar_seed || row.id.substring(0, 8),
      status: row.status,
      isPublished: !!row.is_published,
      isSubmitted: !!row.is_submitted,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      candidateNumber: row.candidate_number || this.fallbackCandidateNumber(row.id),
      firstName: row.first_name || '',
      lastName: row.last_name || '',
      city: row.city || '',
      country: row.country || '',
      address: row.address || undefined,
      zipCode: row.zip_code || undefined,
      phoneNumber: row.phone_number || undefined,
      industry: row.industry || '',
      profession: normalized.profession,
      experienceYears: row.experience_years || 0,
      availability: row.availability || '',
      salaryWishEur: normalized.salaryWishEur,
      workRadiusKm: normalized.workRadiusKm,
      workArea: row.work_area ?? null,
      birthYear: row.birth_year || undefined,
      about: normalized.about || undefined,
      languages: row.languages?.trim() || null,
      skills: row.skills || [],
      boostedKeywords: row.boosted_keywords || [],
      socialLinks: row.social_links || [],
      profileImageUrl: row.profile_image_url || undefined,
      cvReviewedAt: row.cv_reviewed_at || null,
      recruiterEditingUserId: isRecruiterEditingClaimStale(row.recruiter_editing_at)
        ? null
        : row.recruiter_editing_user_id ?? null,
      recruiterEditingLabel: isRecruiterEditingClaimStale(row.recruiter_editing_at)
        ? null
        : row.recruiter_editing_label ?? null,
      recruiterEditingAt: isRecruiterEditingClaimStale(row.recruiter_editing_at)
        ? null
        : row.recruiter_editing_at ?? null,
      documents: this.documentsToList(docs, !!row.is_published),
    };
  }

  private profileRowToUser(row: ProfileRow): User {
    const fromEmail = recruiterRoleFromEmail(row.email);
    const role = isRecruiterRole(row.role)
      ? row.role
      : fromEmail !== UserRole.CANDIDATE
        ? fromEmail
        : row.role;
    return {
      id: row.id,
      email: row.email,
      role,
      createdAt: row.created_at,
      firstName: row.first_name || undefined,
    };
  }

  private async ensureOwnProfile(userId: string): Promise<ProfileRow | null> {
    const authUser = await this.currentAuthUser();
    if (!authUser || authUser.id !== userId) {
      return null;
    }

    const existing = await this.fetchProfileRow(userId);
    if (existing) {
      return existing.deleted_at ? null : existing;
    }

    const role = recruiterRoleFromEmail(authUser.email);
    const now = new Date().toISOString();
    const candidateNumber = await this.generateCandidateNumber();
    const payload = {
      id: userId,
      email: authUser.email || '',
      role,
      first_name: '',
      last_name: '',
      city: '',
      country: '',
      address: null,
      zip_code: null,
      phone_number: null,
      industry: '',
      profession: null,
      experience_years: 0,
      availability: '',
      salary_wish_eur: null,
      work_radius_km: null,
      work_area: null,
      birth_year: null,
      about: null,
      languages: null,
      profile_image_url: null,
      avatar_seed: userId.substring(0, 8),
      status: CandidateStatus.REVIEW,
      is_published: false,
      is_submitted: false,
      cv_reviewed_at: null,
      cv_reviewed_by: null,
      skills: [],
      boosted_keywords: [],
      social_links: [],
      deleted_at: null,
      created_at: now,
      updated_at: now,
      candidate_number: candidateNumber,
      recruiter_editing_user_id: null,
      recruiter_editing_label: null,
      recruiter_editing_at: null,
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      return null;
    }

    const inserted = await this.fetchProfileRow(userId);
    return inserted?.deleted_at ? null : inserted;
  }

  private async loadDocumentIndex(userIds: string[]): Promise<Map<string, DocumentRow>> {
    const uniqueIds = Array.from(new Set(userIds.filter(Boolean)));
    if (uniqueIds.length === 0) {
      return new Map();
    }

    const { data, error } = await supabase
      .from('candidate_documents')
      .select('*')
      .in('user_id', uniqueIds);

    if (error || !data) {
      return new Map();
    }

    return new Map((data as DocumentRow[]).map((row) => [row.user_id, row]));
  }

  async getSessionUser(): Promise<User | null> {
    const authUser = await this.currentAuthUser();
    if (!authUser) {
      return null;
    }

    const profile = await this.ensureOwnProfile(authUser.id) || await this.fetchProfileRow(authUser.id);
    if (!profile || profile.deleted_at) {
      return null;
    }

    return this.profileRowToUser(profile);
  }

  private async getEffectiveSessionRole(): Promise<UserRole | null> {
    const current = await this.getSessionUser();
    if (current?.role) return current.role;
    const authUser = await this.currentAuthUser();
    if (!authUser) return null;
    return recruiterRoleFromEmail(authUser.email);
  }

  async verifyEmail(): Promise<{ success: boolean; message?: string; error?: string }> {
    const url = new URL(window.location.href);
    const code = url.searchParams.get('code');
    const tokenHash = url.searchParams.get('token_hash');
    const type = url.searchParams.get('type');

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        return { success: true, message: 'E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.' };
      }
      if (!tokenHash) {
        return { success: false, error: formatAuthError(error.message) };
      }
    }

    if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as any,
      });

      if (error) {
        return { success: false, error: formatAuthError(error.message) };
      }

      return { success: true, message: 'E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.' };
    }

    const { data } = await supabase.auth.getSession();
    if (data.session) {
      return { success: true, message: 'E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.' };
    }

    return {
      success: false,
      error: 'Kein Bestätigungslink gefunden. Bitte nutzen Sie den Link aus Ihrer E-Mail.',
    };
  }

  async register(email: string, password: string, role: string) {
    const normalizedEmail = normalizeEmail(email);

    if (role !== UserRole.CANDIDATE) {
      return {
        success: false,
        error: 'Recruiter-Registrierung ist deaktiviert. Bitte mit einem Supabase-Auth-Account anmelden.',
      };
    }

    if (isRecruiterEmail(normalizedEmail)) {
      return {
        success: false,
        error: 'Diese E-Mail ist für Recruiter reserviert. Bitte mit dem bestehenden Account anmelden.',
      };
    }

    const redirectTo = `${window.location.origin}/verify-email`;
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        emailRedirectTo: redirectTo,
        data: { role: UserRole.CANDIDATE },
      },
    });

    if (error) {
      return { success: false, error: formatAuthError(error.message) };
    }

    const user = await this.getSessionUser();
    if (user) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return { success: true, user };
    }

    return {
      success: true,
      needsVerification: true,
      message:
        'Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den Supabase an Sie sendet.',
    };
  }

  async login(email: string, password: string, expectedRole?: string) {
    const normalizedEmail = normalizeEmail(email);

    if (expectedRole === UserRole.RECRUITER && !isRecruiterEmail(normalizedEmail)) {
      return { success: false, error: 'Dieser Recruiter-Account ist nicht freigeschaltet.' };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      return { success: false, error: formatAuthError(error.message) };
    }

    const user = await this.getSessionUser();
    if (!user) {
      await supabase.auth.signOut();
      return { success: false, error: 'Anmeldung fehlgeschlagen.' };
    }

    if (expectedRole === UserRole.CANDIDATE && user.role !== UserRole.CANDIDATE) {
      await supabase.auth.signOut();
      return { success: false, error: 'Keine Berechtigung für diesen Bereich.' };
    }

    if (expectedRole === UserRole.RECRUITER && !isRecruiterRole(user.role)) {
      await supabase.auth.signOut();
      return { success: false, error: 'Keine Berechtigung für diesen Bereich.' };
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
    return { success: true, user };
  }

  /** Konto löschen: nutzt die bestehende Sitzung (Kandidat muss eingeloggt sein). */
  async deleteAccount() {
    const authUser = await this.currentAuthUser();
    if (!authUser) {
      return { success: false, error: 'Nicht eingeloggt.' };
    }

    const user = await this.getSessionUser();
    if (!user) {
      return { success: false, error: 'Nicht eingeloggt.' };
    }

    if (user.id !== authUser.id) {
      return { success: false, error: 'Sitzung ungültig.' };
    }

    if (user.role !== UserRole.CANDIDATE) {
      return { success: false, error: 'Nur Kandidaten können ihr Konto hier löschen.' };
    }

    const now = new Date().toISOString();
    const { error: profileError } = await supabase
      .from('profiles')
      .update({
        deleted_at: now,
        is_published: false,
        is_submitted: false,
        status: CandidateStatus.BLOCKED,
        updated_at: now,
      })
      .eq('id', user.id);

    if (profileError) {
      await supabase.auth.signOut();
      return { success: false, error: 'Konto konnte nicht gelöscht werden.' };
    }

    await supabase.from('candidate_documents').delete().eq('user_id', user.id);
    localStorage.removeItem(SESSION_KEY);
    await supabase.auth.signOut();
    return { success: true };
  }

  async getCandidates() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .eq('is_published', true)
      .eq('status', CandidateStatus.ACTIVE)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    const rows = data as ProfileRow[];
    const docs = await this.loadDocumentIndex(rows.map((row) => row.id));
    const base = rows.map((row) => this.profileRowToCandidate(row, docs.get(row.id)));
    const fallbackClaims = await this.readEditingClaimsFromAudit(base.map((c) => c.userId));
    const mergedBase = base.map((c) => this.mergeAuditEditingClaim(c, fallbackClaims.get(c.userId)));
    const remoteExternal = await this.loadExternalCandidatesRemote();
    const external = (remoteExternal || this.readLocalExternalCandidates()).filter(
      (c) => c.isPublished && c.status === CandidateStatus.ACTIVE
    );
    const merged = this.mergeUniqueCandidates(mergedBase, external);
    return merged.map((c) => this.toMarketplaceCodename(c));
  }

  async getAllCandidates() {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    const rows = data as ProfileRow[];
    const docs = await this.loadDocumentIndex(rows.map((row) => row.id));
    const base = rows.map((row) => this.profileRowToCandidate(row, docs.get(row.id)));
    const fallbackClaims = await this.readEditingClaimsFromAudit(base.map((c) => c.userId));
    const mergedBase = base.map((c) => this.mergeAuditEditingClaim(c, fallbackClaims.get(c.userId)));
    const remoteExternal = await this.loadExternalCandidatesRemote();
    const external = remoteExternal || this.readLocalExternalCandidates();
    return this.mergeUniqueCandidates(mergedBase, external);
  }

  /** Alle aktiven Profil-Konten (inkl. ohne eingereichtes Formular) – nur für Recruiter/Admin. */
  async listRegisteredUsers(): Promise<RegisteredUserListItem[]> {
    const current = await this.getSessionUser();
    if (!current || !isRecruiterRole(current.role)) {
      return [];
    }

    // Backward-compat: last_seen_at kann fehlen, wenn Migrationen noch nicht ausgeführt wurden.
    const load = async (includeLastSeen: boolean) => {
      const select = includeLastSeen
        ? 'id,email,role,first_name,last_name,is_submitted,is_published,created_at,updated_at,last_seen_at'
        : 'id,email,role,first_name,last_name,is_submitted,is_published,created_at,updated_at';
      return await supabase
        .from('profiles')
        .select(select)
        .is('deleted_at', null)
        .order('created_at', { ascending: false });
    };

    const res1 = await load(true);
    let data = res1.data as any[] | null | undefined;
    let error = res1.error;

    if (error || !data) {
      const msg = (error?.message || '').toLowerCase();
      const missingLastSeen = msg.includes('last_seen_at') || msg.includes('column');
      if (missingLastSeen) {
        const res2 = await load(false);
        data = res2.data as any[] | null | undefined;
        error = res2.error;
      }
    }

    if (error || !data) return [];

    type Row = {
      id: string;
      email: string;
      role: string;
      first_name: string;
      last_name: string;
      is_submitted: boolean;
      is_published: boolean;
      created_at: string;
      updated_at: string;
      last_seen_at?: string | null;
    };

    return (data as Row[]).map((r) => ({
      id: r.id,
      email: r.email,
      role:
        r.role === 'recruiter_admin'
          ? UserRole.ADMIN
          : r.role === 'recruiter'
            ? UserRole.RECRUITER
            : UserRole.CANDIDATE,
      firstName: r.first_name || '',
      lastName: r.last_name || '',
      isSubmitted: !!r.is_submitted,
      isPublished: !!r.is_published,
      createdAt: r.created_at,
      // Primär last_seen_at, robustes Fallback auf updated_at (wird beim Heartbeat ebenfalls aktualisiert).
      lastSeenAt: (r.last_seen_at ?? r.updated_at ?? null) as any,
    }));
  }

  /** Client-Heartbeat: aktualisiert last_seen_at für das eingeloggte Profil. */
  async touchLastSeen(): Promise<void> {
    const authUser = await this.currentAuthUser();
    if (!authUser) return;

    const now = new Date().toISOString();
    const { error } = await supabase
      .from('profiles')
      .update({ last_seen_at: now, updated_at: now })
      .eq('id', authUser.id);

    if (error) {
      // DB-Schema älter: last_seen_at evtl. nicht vorhanden -> dann nur updated_at schreiben.
      const msg = (error.message || '').toLowerCase();
      if (msg.includes('last_seen_at') || msg.includes('column')) {
        const { error: fallbackError } = await supabase
          .from('profiles')
          .update({ updated_at: now })
          .eq('id', authUser.id);
        if (!fallbackError) return;
        throw new Error(fallbackError.message);
      }
      throw new Error(error.message);
    }
  }

  async getCandidate(userId: string) {
    const row = await this.fetchProfileRow(userId);
    if (!row) {
      const created = await this.ensureOwnProfile(userId);
      if (!created || created.deleted_at) {
        return null;
      }
      const docs = await this.fetchDocumentRow(userId);
      const base = this.profileRowToCandidate(created, docs);
      const fallbackClaims = await this.readEditingClaimsFromAudit([userId]);
      return this.mergeAuditEditingClaim(base, fallbackClaims.get(userId));
    }

    if (row.deleted_at) {
      return null;
    }

    const docs = await this.fetchDocumentRow(userId);
    const base = this.profileRowToCandidate(row, docs);
    const fallbackClaims = await this.readEditingClaimsFromAudit([userId]);
    return this.mergeAuditEditingClaim(base, fallbackClaims.get(userId));
  }

  async updateCandidate(userId: string, data: any) {
    const current = await this.fetchProfileRow(userId);
    const authUser = await this.currentAuthUser();
    const currentRole = current?.role || recruiterRoleFromEmail(authUser?.email ?? null);
    const isAdmin = currentRole === UserRole.ADMIN;
    const isOwnerCandidate = !!authUser && authUser.id === userId && currentRole === UserRole.CANDIDATE;

    /** War auf dem Marktplatz sichtbar (freigegeben) */
    const wasMarketplaceLive =
      !!current?.is_published && current?.status === CandidateStatus.ACTIVE;

    let nextSubmitted: boolean;
    let nextStatus: CandidateStatus;
    let nextPublished: boolean;
    let nextCvReviewedAt: string | null = current?.cv_reviewed_at ?? null;
    let nextCvReviewedBy: string | null = current?.cv_reviewed_by ?? null;

    if (isAdmin) {
      nextSubmitted = !!data.isSubmitted;
      nextStatus = (data.status as CandidateStatus) || CandidateStatus.REVIEW;
      nextPublished = !!data.isPublished;
    } else if (isOwnerCandidate && wasMarketplaceLive) {
      // Nach Freigabe geändert: vom Marktplatz nehmen, CV-Prüfung zurücksetzen,
      // Einreichung löschen bis erneut „Zum Recruiter senden“.
      nextPublished = false;
      nextCvReviewedAt = null;
      nextCvReviewedBy = null;
      if (data.isSubmitted) {
        nextSubmitted = true;
        nextStatus = CandidateStatus.REVIEW;
      } else {
        nextSubmitted = false;
        nextStatus = CandidateStatus.REVIEW;
      }
    } else if (isOwnerCandidate) {
      nextSubmitted = !!current?.is_submitted || !!data.isSubmitted;
      nextPublished = nextSubmitted ? false : !!current?.is_published;
      nextStatus = nextSubmitted
        ? CandidateStatus.REVIEW
        : (current?.status || data.status || CandidateStatus.REVIEW);
    } else {
      nextSubmitted = !!current?.is_submitted || !!data.isSubmitted;
      nextPublished = nextSubmitted ? false : !!current?.is_published;
      nextStatus = nextSubmitted
        ? CandidateStatus.REVIEW
        : (current?.status || data.status || CandidateStatus.REVIEW);
    }

    // Kandidat: bei eingereichtem Profil müssen Lebenslauf + mind. eine Qualifikation in der DB liegen
    if (isOwnerCandidate && nextSubmitted) {
      const docRow = await this.fetchDocumentRow(userId);
      const hasCv = !!docRow?.cv_pdf?.data?.trim() && !!docRow?.cv_pdf?.name?.trim();
      const hasQual =
        Array.isArray(docRow?.qualifications) &&
        docRow.qualifications.some((q) => q?.data?.trim() && q?.name?.trim());
      if (!hasCv) {
        throw new Error(
          'Zum Einreichen ist ein Lebenslauf (PDF) erforderlich. Bitte unter „Dokumente“ hochladen und zuerst speichern.'
        );
      }
      if (!hasQual) {
        throw new Error(
          'Zum Einreichen ist mindestens eine Qualifikation (PDF) erforderlich. Bitte unter „Dokumente“ hochladen und zuerst speichern.'
        );
      }
    }

    // Kandidat bearbeitet eigenes Profil → Team-Meldung zurücksetzen
    let nextEditingUserId = current?.recruiter_editing_user_id ?? null;
    let nextEditingLabel = current?.recruiter_editing_label ?? null;
    let nextEditingAt = current?.recruiter_editing_at ?? null;
    if (isOwnerCandidate) {
      nextEditingUserId = null;
      nextEditingLabel = null;
      nextEditingAt = null;
    }

    const now = new Date().toISOString();
    const existingCandidateNumber = current?.candidate_number || this.fallbackCandidateNumber(userId);
    const payload = {
      id: userId,
      email: current?.email || authUser?.email || '',
      role: current?.role || recruiterRoleFromEmail(authUser?.email ?? null),
      // Kandidat darf Vor-/Nachname selbst pflegen; Kandidatennummer bleibt separat/fix.
      first_name: data.firstName ?? current?.first_name ?? '',
      last_name: data.lastName ?? current?.last_name ?? '',
      city: data.city || current?.city || '',
      country: data.country || current?.country || '',
      address: data.address ?? current?.address ?? null,
      zip_code: data.zipCode ?? current?.zip_code ?? null,
      phone_number: data.phoneNumber ?? current?.phone_number ?? null,
      industry: data.industry || current?.industry || '',
      profession: data.profession ?? current?.profession ?? null,
      experience_years: Number(data.experienceYears ?? current?.experience_years ?? 0),
      availability: data.availability || current?.availability || '',
      salary_wish_eur: data.salaryWishEur ?? current?.salary_wish_eur ?? null,
      work_radius_km: data.workRadiusKm ?? current?.work_radius_km ?? null,
      work_area: data.workArea ?? current?.work_area ?? null,
      birth_year: data.birthYear ?? current?.birth_year ?? null,
      about: data.about ?? current?.about ?? null,
      languages:
        data.languages !== undefined ? (String(data.languages ?? '').trim() || null) : (current?.languages ?? null),
      profile_image_url: data.profileImageUrl ?? current?.profile_image_url ?? null,
      avatar_seed: current?.avatar_seed || userId.substring(0, 8),
      status: nextStatus,
      is_published: nextPublished,
      is_submitted: nextSubmitted,
      cv_reviewed_at: nextCvReviewedAt,
      cv_reviewed_by: nextCvReviewedBy,
      skills: Array.isArray(data.skills) ? data.skills : current?.skills || [],
      boosted_keywords: Array.isArray(data.boostedKeywords) ? data.boostedKeywords : current?.boosted_keywords || [],
      social_links: Array.isArray(data.socialLinks) ? data.socialLinks : current?.social_links || [],
      deleted_at: current?.deleted_at ?? null,
      created_at: current?.created_at || now,
      updated_at: now,
      candidate_number: existingCandidateNumber,
      recruiter_editing_user_id: nextEditingUserId,
      recruiter_editing_label: nextEditingLabel,
      recruiter_editing_at: nextEditingAt,
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'id' });
    if (error) {
      // Backward-compat: ältere DBs ohne neuere Profiles-Spalten sollen trotzdem speichern können.
      if (
        isRecruiterEditingSchemaMissing(error.message) ||
        isCandidateNumberSchemaMissing(error.message) ||
        isProfileSalaryWorkSchemaMissing(error.message) ||
        isProfileLanguagesSchemaMissing(error.message)
      ) {
        const {
          salary_wish_eur: _dropSalaryWish,
          work_radius_km: _dropWorkRadius,
          work_area: _dropWorkArea,
          profession: _dropProfession,
          candidate_number: _dropCandidateNumber,
          recruiter_editing_user_id: _dropUser,
          recruiter_editing_label: _dropLabel,
          recruiter_editing_at: _dropAt,
          languages: _dropLanguages,
          ...legacyPayload
        } = payload as any;
        // Legacy-Fallback: wenn neue Spalten fehlen, Felder kompatibel in about mit Marker mitschreiben.
        legacyPayload.about = this.withLegacyProfileFieldsInAbout(
          data.profession ?? current?.profession ?? null,
          data.salaryWishEur ?? current?.salary_wish_eur ?? null,
          data.workRadiusKm ?? current?.work_radius_km ?? null,
          legacyPayload.about ?? null
        );
        const { error: retryError } = await supabase.from('profiles').upsert(legacyPayload, { onConflict: 'id' });
        if (retryError) {
          throw new Error(retryError.message);
        }
      } else {
        throw new Error(error.message);
      }
    }

    const updated = await this.fetchProfileRow(userId);
    if (!updated || updated.deleted_at) {
      throw new Error('Profil konnte nicht gespeichert werden.');
    }

    const docs = await this.fetchDocumentRow(userId);
    return this.profileRowToCandidate(updated, docs);
  }

  /**
   * Recruiter meldet, dass er ein Kandidatenprofil bearbeitet (oder beendet die Meldung).
   */
  async setRecruiterEditingClaim(candidateUserId: string, active: boolean): Promise<void> {
    const sessionUser = await this.getSessionUser();
    if (!sessionUser || !isRecruiterRole(sessionUser.role)) {
      throw new Error('Keine Berechtigung für diese Aktion.');
    }

    const now = new Date().toISOString();
    const label = recruiterClaimLabelFromUser(sessionUser);

    if (!active) {
      const row = await this.fetchProfileRow(candidateUserId);
      if (!row || row.deleted_at) {
        throw new Error('Kandidat nicht gefunden.');
      }
      let isClaimOwner = row.recruiter_editing_user_id === sessionUser.id;
      if (!row.recruiter_editing_user_id) {
        const fallbackClaims = await this.readEditingClaimsFromAudit([candidateUserId]);
        const fallback = fallbackClaims.get(candidateUserId);
        isClaimOwner = !!fallback && fallback.userId === sessionUser.id;
      }
      const isAdmin = sessionUser.role === UserRole.ADMIN;
      if (!isClaimOwner && !isAdmin) {
        throw new Error('Nur der gemeldete Recruiter kann die Bearbeitung beenden.');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          recruiter_editing_user_id: null,
          recruiter_editing_label: null,
          recruiter_editing_at: null,
          updated_at: now,
        })
        .eq('id', candidateUserId);

      if (error) {
        if (!isRecruiterEditingSchemaMissing(error.message)) {
          throw new Error(error.message);
        }
      }

      // Fallback (wenn recruiter_editing_* Spalten fehlen): Team-Signal in audit_log speichern.
      const { error: auditErr } = await supabase.from('audit_log').insert({
        id: crypto.randomUUID(),
        action: EDITING_CLAIM_CLEAR,
        performer_id: sessionUser.id,
        target_id: candidateUserId,
        timestamp: now,
      });
      if (auditErr) {
        throw new Error(auditErr.message);
      }
      return;
    }

    const { error } = await supabase
      .from('profiles')
      .update({
        recruiter_editing_user_id: sessionUser.id,
        recruiter_editing_label: label,
        recruiter_editing_at: now,
        updated_at: now,
      })
      .eq('id', candidateUserId)
      .is('deleted_at', null);

    if (error) {
      if (!isRecruiterEditingSchemaMissing(error.message)) {
        throw new Error(error.message);
      }
    }

    // Fallback (wenn recruiter_editing_* Spalten fehlen): Team-Signal in audit_log speichern.
    const { error: auditErr } = await supabase.from('audit_log').insert({
      id: crypto.randomUUID(),
      action: `${EDITING_CLAIM_SET_PREFIX}${sessionUser.id}:${encodeURIComponent(label)}`,
      performer_id: sessionUser.id,
      target_id: candidateUserId,
      timestamp: now,
    });
    if (auditErr) {
      throw new Error(auditErr.message);
    }
  }

  async adminAction(
    userId: string,
    action: 'delete' | 'status' | 'publish' | 'unpublish' | 'cv_reviewed',
    newStatus?: CandidateStatus,
    performerId?: string
  ): Promise<void> {
    const current = await this.getSessionUser();
    if (!current || !isRecruiterRole(current.role)) {
      throw new Error('Keine Berechtigung für diese Aktion.');
    }

    const effectivePerformerId = performerId || current.id;
    const now = new Date().toISOString();

    if (action === 'delete') {
      await supabase.from('candidate_documents').delete().eq('user_id', userId);
      const { error } = await supabase
        .from('profiles')
        .update({
          deleted_at: now,
          is_published: false,
          is_submitted: false,
          status: CandidateStatus.BLOCKED,
          recruiter_editing_user_id: null,
          recruiter_editing_label: null,
          recruiter_editing_at: null,
          updated_at: now,
        })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      await supabase.from('audit_log').insert({
        id: crypto.randomUUID(),
        action: 'Kandidat gelöscht',
        performer_id: effectivePerformerId,
        target_id: userId,
        timestamp: now,
      });
      return;
    }

    if (action === 'status' && newStatus) {
      const { error } = await supabase
        .from('profiles')
        .update({ status: newStatus, updated_at: now })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      await supabase.from('audit_log').insert({
        id: crypto.randomUUID(),
        action: `Status geändert zu "${newStatus}"`,
        performer_id: effectivePerformerId,
        target_id: userId,
        timestamp: now,
      });
      return;
    }

    if (action === 'cv_reviewed') {
      const docs = await this.fetchDocumentRow(userId);
      if (!docs?.cv_pdf?.name) {
        throw new Error('Kein Lebenslauf vorhanden. Bitte erst CV hochladen.');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          cv_reviewed_at: now,
          cv_reviewed_by: effectivePerformerId,
          updated_at: now,
        })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      await supabase.from('audit_log').insert({
        id: crypto.randomUUID(),
        action: 'Lebenslauf geprüft',
        performer_id: effectivePerformerId,
        target_id: userId,
        timestamp: now,
      });
      return;
    }

    if (action === 'publish') {
      const profile = await this.fetchProfileRow(userId);
      const docs = await this.fetchDocumentRow(userId);

      if (!profile || profile.deleted_at) {
        throw new Error('Kandidat nicht gefunden.');
      }

      if (!docs?.cv_pdf?.name) {
        throw new Error('Kein Lebenslauf vorhanden. Bitte erst CV hochladen.');
      }

      const canLegacyPublish = profile.status === CandidateStatus.ACTIVE && !profile.is_published;
      if (!profile.is_submitted && !canLegacyPublish) {
        throw new Error('Profil ist nicht eingereicht. Bitte zuerst "Zum Recruiter senden".');
      }

      if (!profile.cv_reviewed_at) {
        throw new Error('Lebenslauf wurde noch nicht geprüft. Bitte CV ansehen und prüfen.');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          status: CandidateStatus.ACTIVE,
          is_published: true,
          is_submitted: false,
          updated_at: now,
        })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      // Marktplatz zeigt bewusst nur bearbeitete Dokumente.
      // Kein automatisches Kopieren von Originalen in edited_* beim Freigeben.

      await supabase.from('audit_log').insert({
        id: crypto.randomUUID(),
        action: 'Profil veröffentlicht (freigegeben)',
        performer_id: effectivePerformerId,
        target_id: userId,
        timestamp: now,
      });
      return;
    }

    if (action === 'unpublish') {
      const profile = await this.fetchProfileRow(userId);
      if (!profile || profile.deleted_at) {
        throw new Error('Kandidat nicht gefunden.');
      }

      const { error } = await supabase
        .from('profiles')
        .update({
          is_published: false,
          updated_at: now,
        })
        .eq('id', userId);

      if (error) {
        throw new Error(error.message);
      }

      await supabase.from('audit_log').insert({
        id: crypto.randomUUID(),
        action: 'Vom Marktplatz entfernt',
        performer_id: effectivePerformerId,
        target_id: userId,
        timestamp: now,
      });
      return;
    }
  }

  async getDocuments(userId: string): Promise<CandidateDocuments | undefined> {
    if (userId.startsWith('external:')) {
      const externalId = userId.slice('external:'.length);
      const { data } = await supabase
        .from('external_candidates')
        .select('cv_pdf,certificates,qualifications')
        .eq('id', externalId)
        .maybeSingle();
      if (data) {
        const row = data as {
          cv_pdf?: { name: string; data: string } | null;
          certificates?: { name: string; data: string }[] | null;
          qualifications?: { name: string; data: string }[] | null;
        };
        return {
          userId,
          cvPdf: row.cv_pdf || undefined,
          certificates: row.certificates || [],
          qualifications: row.qualifications || [],
        };
      }
    }
    const profile = await this.fetchProfileRow(userId);
    const row = await this.fetchDocumentRow(userId);
    const hasEditedColumns =
      !!row &&
      (Object.prototype.hasOwnProperty.call(row as object, 'edited_cv_pdf') ||
        Object.prototype.hasOwnProperty.call(row as object, 'edited_certificates') ||
        Object.prototype.hasOwnProperty.call(row as object, 'edited_qualifications'));
    const hasEditedContent = !!(
      row?.edited_cv_pdf?.name ||
      (row?.edited_certificates?.length ?? 0) > 0 ||
      (row?.edited_qualifications?.length ?? 0) > 0
    );
    const useEdited = hasEditedColumns && (hasEditedContent || !!profile?.is_published);
    return row
      ? this.documentRowToDocuments(row, useEdited)
      : {
          userId,
          certificates: [],
          qualifications: [],
        };
  }

  async getMarketplaceDocuments(userId: string): Promise<CandidateDocuments | undefined> {
    if (userId.startsWith('external:')) {
      return this.getDocuments(userId);
    }
    const row = await this.fetchDocumentRow(userId);
    if (!row) {
      return { userId, certificates: [], qualifications: [] };
    }
    const hasEditedColumns =
      Object.prototype.hasOwnProperty.call(row as object, 'edited_cv_pdf') ||
      Object.prototype.hasOwnProperty.call(row as object, 'edited_certificates') ||
      Object.prototype.hasOwnProperty.call(row as object, 'edited_qualifications');
    if (hasEditedColumns) {
      return this.documentRowToDocuments(row, true);
    }
    // Legacy fallback (ohne edited_* Spalten): Marktplatz-Version liegt in Basisspalten.
    return this.documentRowToDocuments(row, false);
  }

  /** Originaldokumente (für Kandidaten): unabhängig davon, ob der Nutzer bereits veröffentlicht ist. */
  async getOriginalDocuments(userId: string): Promise<CandidateDocuments | undefined> {
    if (userId.startsWith('external:')) {
      const externalId = userId.slice('external:'.length);
      const { data } = await supabase
        .from('external_candidates')
        .select('cv_pdf,certificates,qualifications')
        .eq('id', externalId)
        .maybeSingle();
      if (data) {
        const row = data as {
          cv_pdf?: { name: string; data: string } | null;
          certificates?: { name: string; data: string }[] | null;
          qualifications?: { name: string; data: string }[] | null;
        };
        return {
          userId,
          cvPdf: row.cv_pdf || undefined,
          certificates: row.certificates || [],
          qualifications: row.qualifications || [],
        };
      }
    }

    const row = await this.fetchDocumentRow(userId);
    return row
      ? this.documentRowToDocuments(row, false)
      : {
          userId,
          certificates: [],
          qualifications: [],
        };
  }

  async getDocumentsForRecruiter(userId: string): Promise<CandidateDocumentsForRecruiter | undefined> {
    if (userId.startsWith('external:')) {
      // Externe Kandidaten haben derzeit nur „Originale“ (ohne separate edited-Spalten).
      const externalId = userId.slice('external:'.length);
      const { data } = await supabase
        .from('external_candidates')
        .select('cv_pdf,certificates,qualifications')
        .eq('id', externalId)
        .maybeSingle();
      if (!data) return undefined;
      const row = data as {
        cv_pdf?: { name: string; data: string } | null;
        certificates?: { name: string; data: string }[] | null;
        qualifications?: { name: string; data: string }[] | null;
      };
      const original: CandidateDocuments = {
        userId,
        cvPdf: row.cv_pdf || undefined,
        certificates: row.certificates || [],
        qualifications: row.qualifications || [],
      };
      const edited = this.readLocalEditedDocuments(userId) || original;
      return { userId, original, edited };
    }

    const row = await this.fetchDocumentRow(userId);
    if (!row) return undefined;
    const dbOriginal = this.documentRowToDocuments(row, false);
    const hasEditedColumns =
      Object.prototype.hasOwnProperty.call(row as object, 'edited_cv_pdf') ||
      Object.prototype.hasOwnProperty.call(row as object, 'edited_certificates') ||
      Object.prototype.hasOwnProperty.call(row as object, 'edited_qualifications');
    const original = hasEditedColumns ? dbOriginal : (this.readLocalOriginalDocuments(userId) || dbOriginal);
    const edited = hasEditedColumns
      ? this.documentRowToDocuments(row, true)
      : (this.readLocalEditedDocuments(userId) || original);
    return { userId, original, edited };
  }

  async updateEditedDocuments(userId: string, data: CandidateDocuments): Promise<void> {
    const role = await this.getEffectiveSessionRole();
    if (!role || !isRecruiterRole(role)) {
      throw new Error('Keine Berechtigung für das Bearbeiten der Dokumente.');
    }

    // Externe Kandidaten haben keine separaten edited_* DB-Spalten.
    // Daher bearbeiten wir diese Marktplatz-Version lokal getrennt von den Originalen.
    if (userId.startsWith('external:')) {
      this.writeLocalEditedDocuments(userId, data);
      return;
    }

    const now = new Date().toISOString();
    const payload = {
      user_id: userId,
      edited_cv_pdf: data.cvPdf || null,
      edited_certificates: data.certificates || [],
      edited_qualifications: data.qualifications || [],
      updated_at: now,
    };

    const { error } = await supabase.from('candidate_documents').upsert(payload, { onConflict: 'user_id' });
    if (!error) return;

    // Legacy fallback: edited_* Spalten fehlen.
    // In diesem Fall speichern wir separat lokal, damit Original-Dokumente unverändert bleiben.
    if (isEditedDocumentsSchemaMissing(error.message)) {
      const current = await this.getOriginalDocuments(userId);
      if (current) this.writeLocalOriginalDocumentsIfMissing(userId, current);
      this.writeLocalEditedDocuments(userId, data);

      // Kompatibilitäts-Fallback:
      // Wenn edited_* Spalten fehlen, persistieren wir die Marktplatz-Version in Standardspalten,
      // damit sie öffentlich im Marktplatz sichtbar ist.
      const fallbackPayload = {
        user_id: userId,
        cv_pdf: data.cvPdf || null,
        certificates: data.certificates || [],
        qualifications: data.qualifications || [],
        updated_at: now,
      };
      const { error: baseErr } = await supabase.from('candidate_documents').upsert(fallbackPayload, { onConflict: 'user_id' });
      if (baseErr) throw new Error(baseErr.message);
      return;
    }

    throw new Error(error.message);
  }

  async updateDocuments(userId: string, data: CandidateDocuments) {
    const now = new Date().toISOString();
    const authUser = await this.currentAuthUser();
    const profile = await this.fetchProfileRow(userId);
    const isOwnerCandidate =
      !!authUser &&
      authUser.id === userId &&
      !!profile &&
      !isRecruiterRole(profile.role);
    const wasMarketplaceLive =
      !!profile?.is_published && profile?.status === CandidateStatus.ACTIVE;

    const payload = {
      user_id: userId,
      cv_pdf: data.cvPdf || null,
      certificates: data.certificates || [],
      qualifications: data.qualifications || [],
      updated_at: now,
    };

    const { error } = await supabase.from('candidate_documents').upsert(payload, { onConflict: 'user_id' });
    if (error) {
      throw new Error(error.message);
    }

    // Dokumente geändert während Profil live war → Marktplatz + Freigabe zurücksetzen
    if (isOwnerCandidate && wasMarketplaceLive) {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          is_published: false,
          status: CandidateStatus.REVIEW,
          is_submitted: false,
          cv_reviewed_at: null,
          cv_reviewed_by: null,
          updated_at: now,
        })
        .eq('id', userId);
      if (pErr) {
        throw new Error(pErr.message);
      }
    } else {
      const { error: pErr } = await supabase
        .from('profiles')
        .update({
          cv_reviewed_at: null,
          cv_reviewed_by: null,
          updated_at: now,
        })
        .eq('id', userId);
      if (pErr) {
        throw new Error(pErr.message);
      }
    }
  }

  async getAuditLog(): Promise<AuditLog[]> {
    const current = await this.getSessionUser();
    if (!current || !isRecruiterRole(current.role)) {
      return [];
    }

    const { data, error } = await supabase
      .from('audit_log')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error || !data) {
      return [];
    }

    return (data as any[]).map((row) => ({
      id: row.id,
      action: row.action,
      performerId: row.performer_id,
      targetId: row.target_id,
      timestamp: row.timestamp,
    }));
  }

  async createCandidateInquiry(input: {
    /** Optional: null = allgemeine Marktplatz-Anfrage */
    candidateUserId: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    message?: string;
    customerAttachments?: InquiryCustomerAttachment[];
  }): Promise<void> {
    const attachments = this.normalizeInquiryCustomerAttachments(input.customerAttachments);
    const basePayload = {
      candidate_user_id: input.candidateUserId ?? null,
      contact_name: input.contactName.trim(),
      contact_email: input.contactEmail.trim(),
      contact_phone: input.contactPhone.trim(),
      message: input.message?.trim() || null,
    };
    const payloadWithAttachments =
      attachments.length > 0
        ? { ...basePayload, customer_attachments: attachments }
        : basePayload;

    let { error } = await supabase.from('candidate_inquiries').insert(payloadWithAttachments as Record<string, unknown>);
    if (error && attachments.length > 0 && isCustomerAttachmentsColumnMissing(error.message)) {
      const retry = await supabase.from('candidate_inquiries').insert(basePayload);
      error = retry.error;
    }
    if (error) {
      if (isCandidateInquiriesSchemaMissing(error.message)) {
        // Fallback: Anfrage lokal speichern, damit sie in der Dashboard-Sicht sichtbar bleibt.
        this.pushLocalInquiry({ ...input, customerAttachments: attachments });
        return;
      }
      throw new Error(error.message);
    }
  }

  /**
   * Lokale Fallback-Anfragen (z. B. Safari/Offline oder wenn die Supabase-Abfrage fehlschlägt).
   */
  getLocalInquiriesFallback(): CandidateInquiry[] {
    return this.readLocalInquiries();
  }

  async getCandidateInquiries(): Promise<CandidateInquiry[]> {
    const local = this.readLocalInquiries();
    try {
      // getUser() triggert ggf. einen Netzwerk-Refresh und kann auf Mobilgeräten kurz null liefern,
      // obwohl die Session bereits aus dem Storage da ist — dann würden Anfragen als [] erscheinen.
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.user) {
        return [];
      }

      const { data, error } = await supabase
        .from('candidate_inquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (error || !data) {
        if (isCandidateInquiriesSchemaMissing(error?.message)) {
          return local;
        }
        return local;
      }
      const remote = (data as InquiryRow[]).map((row) => this.inquiryRowToInquiry(row));
      const byId = new Map<string, CandidateInquiry>();
      for (const x of local) {
        byId.set(x.id, x);
      }
      for (const x of remote) {
        byId.set(x.id, x);
      }
      const merged = Array.from(byId.values()).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      return merged.slice(0, 300);
    } catch (e) {
      console.warn('[ApiClient] getCandidateInquiries failed, using local cache', e);
      return local;
    }
  }

  async deleteCandidateInquiry(inquiryId: string): Promise<void> {
    const role = await this.getEffectiveSessionRole();
    if (!role || !isRecruiterRole(role)) {
      return;
    }

    // Lokalen Fallback aktualisieren (falls wir beim Insert/Fetch schon lokal gearbeitet haben).
    try {
      const local = this.readLocalInquiries();
      const next = local.filter((x) => x.id !== inquiryId).slice(0, 300);
      window.localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(next));
    } catch {
      // ignore local fallback errors
    }

    const { error } = await supabase
      .from('candidate_inquiries')
      .delete()
      .eq('id', inquiryId);

    if (error) {
      // Backward-compat: DB ohne candidate_inquiries → wir haben schon lokal entfernt.
      if (isCandidateInquiriesSchemaMissing(error.message)) {
        return;
      }
      throw new Error(error.message);
    }
  }

  async setInquiryEditingClaim(inquiryId: string, active: boolean): Promise<void> {
    const sessionUser = await this.getSessionUser();
    const authUser = await this.currentAuthUser();
    const effectiveRole = sessionUser?.role || recruiterRoleFromEmail(authUser?.email ?? null);
    if (!effectiveRole || !isRecruiterRole(effectiveRole) || !authUser) {
      throw new Error('Keine Berechtigung für diese Aktion.');
    }

    const now = new Date().toISOString();
    const label = recruiterClaimLabelFromUser(
      sessionUser || {
        id: authUser.id,
        email: authUser.email || '',
        role: effectiveRole,
        createdAt: authUser.created_at || now,
      }
    );

    if (!active) {
      const { data, error } = await supabase
        .from('candidate_inquiries')
        .select('id,recruiter_editing_user_id')
        .eq('id', inquiryId)
        .maybeSingle();
      if (error) {
        if (isCandidateInquiriesSchemaMissing(error.message)) {
          // Fallback: wenn Tabelle fehlt, lokalen Status zurücksetzen.
          try {
            const local = this.readLocalInquiries();
            const next = local.map((x) =>
              x.id === inquiryId
                ? { ...x, recruiterEditingUserId: null, recruiterEditingLabel: null, recruiterEditingAt: null }
                : x
            );
            window.localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(next.slice(0, 300)));
          } catch {
            // ignore local fallback errors
          }
          return;
        }
        throw new Error(error.message);
      }
      if (!data) throw new Error('Anfrage nicht gefunden.');

      const ownerId = (data as { recruiter_editing_user_id?: string | null }).recruiter_editing_user_id ?? null;
      const isAdmin = effectiveRole === UserRole.ADMIN;
      if (ownerId && ownerId !== authUser.id && !isAdmin) {
        throw new Error('Nur der gemeldete Recruiter kann die Bearbeitung beenden.');
      }

      const { error: updateErr } = await supabase
        .from('candidate_inquiries')
        .update({
          recruiter_editing_user_id: null,
          recruiter_editing_label: null,
          recruiter_editing_at: null,
        })
        .eq('id', inquiryId);
      if (updateErr) {
        if (isCandidateInquiriesSchemaMissing(updateErr.message)) {
          try {
            const local = this.readLocalInquiries();
            const next = local.map((x) =>
              x.id === inquiryId
                ? { ...x, recruiterEditingUserId: null, recruiterEditingLabel: null, recruiterEditingAt: null }
                : x
            );
            window.localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(next.slice(0, 300)));
          } catch {
            // ignore local fallback errors
          }
          return;
        }
        throw new Error(updateErr.message);
      }
      return;
    }

    const { error } = await supabase
      .from('candidate_inquiries')
      .update({
        recruiter_editing_user_id: authUser.id,
        recruiter_editing_label: label,
        recruiter_editing_at: now,
      })
      .eq('id', inquiryId);
    if (error) {
      if (isCandidateInquiriesSchemaMissing(error.message)) {
        // Fallback: wenn Tabelle fehlt, Claim lokal speichern.
        try {
          const local = this.readLocalInquiries();
          const next = local.map((x) =>
            x.id === inquiryId
              ? {
                  ...x,
                  recruiterEditingUserId: authUser.id,
                  recruiterEditingLabel: label,
                  recruiterEditingAt: now,
                }
              : x
          );
          window.localStorage.setItem(LOCAL_INQUIRIES_KEY, JSON.stringify(next.slice(0, 300)));
        } catch {
          // ignore local fallback errors
        }
        return;
      }
      throw new Error(error.message);
    }
  }

  async createExternalCandidate(input: {
    candidateNumber?: string;
    firstName?: string;
    lastName?: string;
    city: string;
    country: string;
    industry: string;
    profession?: string;
    experienceYears: number;
    availability: string;
    salaryWishEur?: number;
    workRadiusKm?: number | null;
    workArea?: string | null;
    about?: string;
    languages?: string;
    skills?: string[];
    boostedKeywords?: string[];
    cvPdf?: { name: string; data: string };
    certificates?: { name: string; data: string }[];
    qualifications?: { name: string; data: string }[];
    isPublished?: boolean;
  }): Promise<CandidateProfile> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const row: ExternalCandidateRow = {
      id,
      candidate_number: input.candidateNumber?.trim() || `EXT-${id.slice(0, 8).toUpperCase()}`,
      first_name: input.firstName?.trim() || null,
      last_name: input.lastName?.trim() || null,
      city: input.city.trim(),
      country: input.country.trim(),
      industry: input.industry.trim(),
      profession: input.profession?.trim() || null,
      experience_years: Number(input.experienceYears || 0),
      availability: input.availability.trim(),
      salary_wish_eur:
        input.salaryWishEur && input.salaryWishEur > 0 ? Math.round(input.salaryWishEur) : null,
      work_radius_km:
        input.workRadiusKm !== null && input.workRadiusKm !== undefined && Number.isFinite(Number(input.workRadiusKm))
          ? Math.max(0, Math.round(Number(input.workRadiusKm)))
          : null,
      work_area: input.workArea?.trim() || null,
      about: input.about?.trim() || null,
      languages: input.languages?.trim() || null,
      skills: (input.skills || []).filter(Boolean),
      boosted_keywords: (input.boostedKeywords || []).filter(Boolean),
      cv_pdf: input.cvPdf || null,
      certificates: input.certificates || [],
      qualifications: input.qualifications || [],
      is_published: !!input.isPublished,
      created_at: now,
      updated_at: now,
    };

    const payload = {
      id: row.id,
      candidate_number: row.candidate_number,
      first_name: row.first_name,
      last_name: row.last_name,
      city: row.city,
      country: row.country,
      industry: row.industry,
      profession: row.profession,
      experience_years: row.experience_years,
      availability: row.availability,
      salary_wish_eur: row.salary_wish_eur,
      work_radius_km: row.work_radius_km,
      work_area: row.work_area,
      about: row.about,
      languages: row.languages,
      skills: row.skills,
      boosted_keywords: row.boosted_keywords,
      cv_pdf: row.cv_pdf,
      certificates: row.certificates,
      qualifications: row.qualifications,
      is_published: row.is_published,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    let insertPayload: Record<string, unknown> = { ...payload };
    let insertError = (await supabase.from('external_candidates').insert(insertPayload)).error;
    if (insertError && isExternalCandidatesProfessionSchemaMissing(insertError.message)) {
      const { profession: _prof, ...noProfession } = insertPayload;
      insertPayload = noProfession;
      const retryProf = await supabase.from('external_candidates').insert(insertPayload);
      if (!retryProf.error) {
        return this.externalRowToCandidate(row);
      }
      insertError = retryProf.error;
    }
    if (insertError && isExternalCandidatesWorkFieldsSchemaMissing(insertError.message)) {
      const { work_radius_km: _wr, work_area: _wa, ...noWork } = insertPayload;
      insertPayload = noWork;
      const retryWork = await supabase.from('external_candidates').insert(insertPayload);
      if (!retryWork.error) {
        return this.externalRowToCandidate(row);
      }
      insertError = retryWork.error;
    }
    if (insertError && isExternalCandidatesNamesSchemaMissing(insertError.message)) {
      const { first_name: _fn, last_name: _ln, ...payloadNoNames } = insertPayload;
      const retry = await supabase.from('external_candidates').insert(payloadNoNames);
      if (!retry.error) {
        return this.externalRowToCandidate(row);
      }
      insertError = retry.error;
    }
    if (insertError) {
      // Fallback: lokal speichern, falls Tabelle noch nicht in DB existiert.
      const local = this.readLocalExternalCandidates();
      const candidate = this.externalRowToCandidate(row);
      this.writeLocalExternalCandidates([candidate, ...local]);
      return candidate;
    }

    return this.externalRowToCandidate(row);
  }
}

export const api = new ApiClient();
