import { CandidateProfile, CandidateStatus, CandidateDocuments, CandidateDocumentsForRecruiter, CandidateInquiry, RegisteredUserListItem, RecruiterAvailabilityEvent, RecruiterTeamMessage } from '../types';
import { api } from './ApiClient';

// =====================================================
// CANDIDATE SERVICE - Using Supabase-backed data access
// =====================================================

class CandidateService {
  // Get all published candidates (public)
  async getAll(): Promise<CandidateProfile[]> {
    try {
      return await api.getCandidates();
    } catch (e) {
      console.error('[CandidateService] Error fetching candidates:', e);
      return [];
    }
  }

  // Get all candidates including unpublished (admin)
  async getAllAdmin(): Promise<CandidateProfile[]> {
    try {
      return await api.getAllCandidates();
    } catch (e) {
      console.error('[CandidateService] Error fetching all candidates:', e);
      return [];
    }
  }

  async listRegisteredUsers(): Promise<RegisteredUserListItem[]> {
    try {
      return await api.listRegisteredUsers();
    } catch (e) {
      console.error('[CandidateService] Error listing registered users:', e);
      return [];
    }
  }

  async touchLastSeen(): Promise<void> {
    try {
      await api.touchLastSeen();
    } catch (e) {
      // Heartbeat ist nicht kritisch; bei Problemen still ignorieren.
    }
  }

  async getById(userId: string): Promise<CandidateProfile | undefined> {
    try {
      return await api.getCandidate(userId);
    } catch (e) {
      console.error('[CandidateService] Error fetching candidate:', e);
      return undefined;
    }
  }

  async createProfile(userId: string): Promise<CandidateProfile> {
    // The backend creates the profile on registration, just fetch it
    const profile = await api.getCandidate(userId);
    if (profile) return profile;

    // If not found, create default profile
    const defaultProfile: CandidateProfile = {
      userId,
      avatarSeed: userId.substring(0, 8),
      status: CandidateStatus.REVIEW,
      isPublished: false,
      isSubmitted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      firstName: '',
      lastName: '',
      city: '',
      country: '',
      industry: '',
      experienceYears: 0,
      availability: '',
      skills: [],
      boostedKeywords: [],
      socialLinks: []
    };

    return await api.updateCandidate(userId, defaultProfile);
  }

  async update(profile: CandidateProfile): Promise<CandidateProfile> {
    return await api.updateCandidate(profile.userId, profile);
  }

  async adminAction(userId: string, action: 'delete' | 'status' | 'publish' | 'unpublish' | 'cv_reviewed', newStatus?: CandidateStatus, performerId?: string): Promise<void> {
    await api.adminAction(userId, action, newStatus, performerId);
  }

  /** Recruiter meldet Bearbeitung am Profil (oder beendet die Meldung). */
  async setRecruiterEditingClaim(candidateUserId: string, active: boolean): Promise<void> {
    await api.setRecruiterEditingClaim(candidateUserId, active);
  }

  async getDocuments(userId: string): Promise<CandidateDocuments | undefined> {
    try {
      return await api.getDocuments(userId);
    } catch (e) {
      console.error('[CandidateService] Error fetching documents:', e);
      return undefined;
    }
  }

  async getMarketplaceDocuments(userId: string): Promise<CandidateDocuments | undefined> {
    try {
      return await api.getMarketplaceDocuments(userId);
    } catch (e) {
      console.error('[CandidateService] Error fetching marketplace documents:', e);
      return undefined;
    }
  }

  async getOriginalDocuments(userId: string): Promise<CandidateDocuments | undefined> {
    try {
      return await api.getOriginalDocuments(userId);
    } catch (e) {
      console.error('[CandidateService] Error fetching original documents:', e);
      return undefined;
    }
  }

  async updateDocuments(docs: CandidateDocuments): Promise<void> {
    await api.updateDocuments(docs.userId, docs);
  }

  async getDocumentsForRecruiter(userId: string): Promise<CandidateDocumentsForRecruiter | undefined> {
    try {
      return await api.getDocumentsForRecruiter(userId);
    } catch (e) {
      console.error('[CandidateService] Error fetching recruiter documents:', e);
      return undefined;
    }
  }

  async updateEditedDocuments(userId: string, docs: CandidateDocuments): Promise<void> {
    await api.updateEditedDocuments(userId, docs);
  }

  async getUniqueSkills(): Promise<string[]> {
    try {
      const candidates = await this.getAll();
      const skillSet = new Set<string>();
      candidates.forEach(c => c.skills?.forEach(s => skillSet.add(s)));
      return Array.from(skillSet).sort();
    } catch (e) {
      console.error('[CandidateService] Error fetching skills:', e);
      return [];
    }
  }

  async createInquiry(input: {
    candidateUserId: string | null;
    contactName: string;
    contactEmail: string;
    contactPhone: string;
    message?: string;
    customerAttachments?: { name: string; data: string }[];
  }): Promise<void> {
    await api.createCandidateInquiry(input);
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
    return await api.createExternalCandidate(input);
  }

  async getInquiries(): Promise<CandidateInquiry[]> {
    try {
      return await api.getCandidateInquiries();
    } catch (e) {
      console.error('[CandidateService] Error fetching inquiries:', e);
      return api.getLocalInquiriesFallback();
    }
  }

  async deleteInquiry(inquiryId: string): Promise<void> {
    try {
      await api.deleteCandidateInquiry(inquiryId);
    } catch (e) {
      console.error('[CandidateService] Error deleting inquiry:', e);
      throw e;
    }
  }

  async setInquiryEditingClaim(inquiryId: string, active: boolean): Promise<void> {
    try {
      await api.setInquiryEditingClaim(inquiryId, active);
    } catch (e) {
      console.error('[CandidateService] Error setting inquiry editing claim:', e);
      throw e;
    }
  }

  async getRecruiterAvailabilityEvents(): Promise<RecruiterAvailabilityEvent[]> {
    return await api.getRecruiterAvailabilityEvents();
  }

  async createRecruiterAvailabilityEvent(input: { title: string; scheduledFor: string; note?: string }): Promise<void> {
    await api.createRecruiterAvailabilityEvent(input);
  }

  async deleteRecruiterAvailabilityEvent(eventId: string): Promise<void> {
    await api.deleteRecruiterAvailabilityEvent(eventId);
  }

  async getRecruiterTeamMessages(limit = 200): Promise<RecruiterTeamMessage[]> {
    return await api.getRecruiterTeamMessages(limit);
  }

  async createRecruiterTeamMessage(message: string): Promise<RecruiterTeamMessage> {
    return await api.createRecruiterTeamMessage(message);
  }

  async deleteRecruiterTeamMessage(messageId: string): Promise<void> {
    await api.deleteRecruiterTeamMessage(messageId);
  }
}

export const candidateService = new CandidateService();
