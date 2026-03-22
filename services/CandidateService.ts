import { CandidateProfile, CandidateStatus, CandidateDocuments } from '../types';
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

  async adminAction(userId: string, action: 'delete' | 'status' | 'publish' | 'cv_reviewed', newStatus?: CandidateStatus, performerId?: string): Promise<void> {
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

  async updateDocuments(docs: CandidateDocuments): Promise<void> {
    await api.updateDocuments(docs.userId, docs);
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
}

export const candidateService = new CandidateService();
