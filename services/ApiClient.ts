import { supabase } from '../utils/supabase';
import {
  AuditLog,
  CandidateDocuments,
  CandidateInquiry,
  CandidateProfile,
  CandidateStatus,
  isRecruiterEditingClaimStale,
  RegisteredUserListItem,
  SocialLink,
  User,
  UserRole,
} from '../types';

const SESSION_KEY = 'cms_talents_session';
const LOCAL_INQUIRIES_KEY = 'cms_talents_local_inquiries';
const LOCAL_EXTERNAL_CANDIDATES_KEY = 'cms_talents_local_external_candidates';
const EDITING_CLAIM_SET_PREFIX = 'editing_claim:set:';
const EDITING_CLAIM_CLEAR = 'editing_claim:clear';

const RECRUITER_ROLE_BY_EMAIL: Record<string, UserRole> = {
  'haagen@industries-cms.com': UserRole.ADMIN,
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
  experience_years: number;
  availability: string;
  birth_year: string | null;
  about: string | null;
  profile_image_url: string | null;
  avatar_seed: string;
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
  updated_at: string | null;
};

type InquiryRow = {
  id: string;
  candidate_user_id: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  message: string | null;
  created_at: string;
};

type ExternalCandidateRow = {
  id: string;
  candidate_number: string | null;
  city: string;
  country: string;
  industry: string;
  experience_years: number;
  availability: string;
  about: string | null;
  skills: string[] | null;
  boosted_keywords: string[] | null;
  cv_pdf: { name: string; data: string } | null;
  certificates: { name: string; data: string }[] | null;
  qualifications: { name: string; data: string }[] | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
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

function recruiterRoleFromEmail(email?: string | null): UserRole {
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

function isCandidateInquiriesSchemaMissing(message?: string): boolean {
  const text = (message || '').toLowerCase();
  return (
    text.includes("could not find the table 'public.candidate_inquiries'") ||
    text.includes("relation \"public.candidate_inquiries\" does not exist") ||
    text.includes("relation \"candidate_inquiries\" does not exist")
  );
}

class ApiClient {
  private externalRowToCandidate(row: ExternalCandidateRow): CandidateProfile {
    const number = row.candidate_number || `EXT-${row.id.slice(0, 8).toUpperCase()}`;
    return {
      userId: `external:${row.id}`,
      avatarSeed: number,
      status: CandidateStatus.ACTIVE,
      isPublished: !!row.is_published,
      isSubmitted: false,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      candidateNumber: number,
      firstName: 'Extern',
      lastName: number,
      city: row.city || '',
      country: row.country || '',
      industry: row.industry || '',
      experienceYears: row.experience_years || 0,
      availability: row.availability || '',
      about: row.about || undefined,
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
    candidateUserId: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    message?: string;
  }): void {
    if (typeof window === 'undefined') return;
    const next: CandidateInquiry = {
      id: `local-${crypto.randomUUID()}`,
      candidateUserId: input.candidateUserId,
      contactName: input.contactName.trim(),
      contactEmail: input.contactEmail.trim(),
      contactPhone: input.contactPhone.trim(),
      message: input.message?.trim() || undefined,
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

  private documentsToList(row: DocumentRow | null | undefined): { type: string; name: string }[] {
    if (!row) return [];

    const items: { type: string; name: string }[] = [];
    if (row.cv_pdf?.name) items.push({ type: 'cv', name: row.cv_pdf.name });
    for (const cert of row.certificates || []) {
      if (cert?.name) items.push({ type: 'certificate', name: cert.name });
    }
    for (const qual of row.qualifications || []) {
      if (qual?.name) items.push({ type: 'qualification', name: qual.name });
    }
    return items;
  }

  private documentRowToDocuments(row: DocumentRow | null | undefined): CandidateDocuments {
    return {
      userId: row?.user_id || '',
      cvPdf: row?.cv_pdf || undefined,
      certificates: row?.certificates || [],
      qualifications: row?.qualifications || [],
    };
  }

  private inquiryRowToInquiry(row: InquiryRow): CandidateInquiry {
    return {
      id: row.id,
      candidateUserId: row.candidate_user_id,
      contactName: row.contact_name,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      message: row.message || undefined,
      createdAt: row.created_at,
    };
  }

  private profileRowToCandidate(row: ProfileRow, docs?: DocumentRow | null): CandidateProfile {
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
      experienceYears: row.experience_years || 0,
      availability: row.availability || '',
      birthYear: row.birth_year || undefined,
      about: row.about || undefined,
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
      documents: this.documentsToList(docs),
    };
  }

  private profileRowToUser(row: ProfileRow): User {
    return {
      id: row.id,
      email: row.email,
      role: row.role,
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
      first_name: 'Kandidat',
      last_name: candidateNumber,
      city: '',
      country: '',
      address: null,
      zip_code: null,
      phone_number: null,
      industry: '',
      experience_years: 0,
      availability: '',
      birth_year: null,
      about: null,
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
    return this.mergeUniqueCandidates(mergedBase, external);
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

    const { data, error } = await supabase
      .from('profiles')
      .select('id,email,role,first_name,last_name,is_submitted,created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });

    if (error || !data) {
      return [];
    }

    type Row = {
      id: string;
      email: string;
      role: string;
      first_name: string;
      last_name: string;
      is_submitted: boolean;
      created_at: string;
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
      createdAt: r.created_at,
    }));
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
      // Kandidat kann Name nicht frei setzen; wir halten einen neutralen Namen + feste Kandidatennummer.
      first_name: isOwnerCandidate ? (current?.first_name || 'Kandidat') : (data.firstName || current?.first_name || ''),
      last_name: isOwnerCandidate ? (current?.last_name || existingCandidateNumber) : (data.lastName || current?.last_name || ''),
      city: data.city || current?.city || '',
      country: data.country || current?.country || '',
      address: data.address ?? current?.address ?? null,
      zip_code: data.zipCode ?? current?.zip_code ?? null,
      phone_number: data.phoneNumber ?? current?.phone_number ?? null,
      industry: data.industry || current?.industry || '',
      experience_years: Number(data.experienceYears ?? current?.experience_years ?? 0),
      availability: data.availability || current?.availability || '',
      birth_year: data.birthYear ?? current?.birth_year ?? null,
      about: data.about ?? current?.about ?? null,
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
      // Backward-compat: ältere DBs ohne recruiter_editing_* Spalten sollen trotzdem speichern können.
      if (isRecruiterEditingSchemaMissing(error.message) || isCandidateNumberSchemaMissing(error.message)) {
        const {
          candidate_number: _dropCandidateNumber,
          recruiter_editing_user_id: _dropUser,
          recruiter_editing_label: _dropLabel,
          recruiter_editing_at: _dropAt,
          ...legacyPayload
        } = payload as any;
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
    action: 'delete' | 'status' | 'publish' | 'cv_reviewed',
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

      await supabase.from('audit_log').insert({
        id: crypto.randomUUID(),
        action: 'Profil veröffentlicht (freigegeben)',
        performer_id: effectivePerformerId,
        target_id: userId,
        timestamp: now,
      });
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
    const row = await this.fetchDocumentRow(userId);
    return row ? this.documentRowToDocuments(row) : {
      userId,
      certificates: [],
      qualifications: [],
    };
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
    candidateUserId: string;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    message?: string;
  }): Promise<void> {
    const payload = {
      candidate_user_id: input.candidateUserId,
      contact_name: input.contactName.trim(),
      contact_email: input.contactEmail.trim(),
      contact_phone: input.contactPhone.trim(),
      message: input.message?.trim() || null,
    };
    const { error } = await supabase.from('candidate_inquiries').insert(payload);
    if (error) {
      if (isCandidateInquiriesSchemaMissing(error.message)) {
        // Fallback: Anfrage lokal speichern, damit sie in der Dashboard-Sicht sichtbar bleibt.
        this.pushLocalInquiry(input);
        return;
      }
      throw new Error(error.message);
    }
  }

  async getCandidateInquiries(): Promise<CandidateInquiry[]> {
    const current = await this.getSessionUser();
    if (!current || !isRecruiterRole(current.role)) {
      return [];
    }
    const local = this.readLocalInquiries();
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
    const merged = [...local, ...remote].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return merged.slice(0, 300);
  }

  async createExternalCandidate(input: {
    candidateNumber?: string;
    city: string;
    country: string;
    industry: string;
    experienceYears: number;
    availability: string;
    about?: string;
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
      city: input.city.trim(),
      country: input.country.trim(),
      industry: input.industry.trim(),
      experience_years: Number(input.experienceYears || 0),
      availability: input.availability.trim(),
      about: input.about?.trim() || null,
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
      city: row.city,
      country: row.country,
      industry: row.industry,
      experience_years: row.experience_years,
      availability: row.availability,
      about: row.about,
      skills: row.skills,
      boosted_keywords: row.boosted_keywords,
      cv_pdf: row.cv_pdf,
      certificates: row.certificates,
      qualifications: row.qualifications,
      is_published: row.is_published,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    const { error } = await supabase.from('external_candidates').insert(payload);
    if (error) {
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
