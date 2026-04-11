
import React, { useState, useEffect } from 'react';
import { CandidateProfile, CandidateStatus, CandidateDocuments, validateProfileForPublishing, validateDocumentsForRecruiterSubmit, canPublishProfile } from '../types';
import { CmsLogoHeroBadge } from '../components/CmsLogoHeroBadge';
import { Button, Input, Select, Avatar, Textarea, FileUpload } from '../components/UI';
import {
  INDUSTRIES,
  AVAILABILITY_OPTIONS,
  BOOSTER_KEYWORD_CATEGORIES,
  WORK_UMKREIS_OPTIONS,
  parseWorkUmkreisOption,
} from '../constants';
import { documentService } from '../services/DocumentService';
import { candidateService } from '../services/CandidateService';
import { authService } from '../services/AuthService';

interface CandidateProfileProps {
  profile: CandidateProfile;
  onNavigate: (path: string) => void;
  onSave: (profile: CandidateProfile) => void;
  onLogout: () => void;
}

// Required field marker component
const RequiredBadge = () => (
  <span className="ml-1 text-xs font-black text-orange-600" title="Pflichtfeld">
    *
  </span>
);

/** Weiße Karten mit orangefarbenem Verlauf (auf Home-Dunkelblau #101B31) */
const PROFILE_CARD =
  'relative overflow-hidden rounded-[1.75rem] border border-orange-200/70 bg-gradient-to-br from-white via-orange-50/95 to-amber-100/80 text-slate-900 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.45),0_0_0_1px_rgba(255,255,255,0.9)_inset] before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-1 before:bg-gradient-to-r before:from-orange-500 before:via-amber-400 before:to-orange-600';

const ProfileCardGlow = () => (
  <div
    className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-orange-400/25 blur-3xl"
    aria-hidden
  />
);

// Improves scroll performance on large profile forms without visual changes.
const SECTION_RENDER_HINT: React.CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: '760px',
};

const CandidateProfilePage: React.FC<CandidateProfileProps> = ({ profile, onNavigate, onSave, onLogout }) => {
  const [formData, setFormData] = useState<CandidateProfile>(profile);
  /** Freies Tippen der Berufserfahrung (ohne sofortiges Zurücksetzen auf 0 wie bei type=number). */
  const [experienceYearsInput, setExperienceYearsInput] = useState(() =>
    profile.experienceYears !== undefined && profile.experienceYears !== null
      ? String(profile.experienceYears)
      : ''
  );
  const [documents, setDocuments] = useState<CandidateDocuments>({
    userId: profile.userId,
    certificates: [],
    qualifications: []
  });
  const [newSkill, setNewSkill] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPublishWarning, setShowPublishWarning] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  /** Pflichtfeld-Hinweise für Lebenslauf / Qualifikationen beim Absenden an Recruiter */
  const [documentFieldErrors, setDocumentFieldErrors] = useState<{ cv?: string; qualifications?: string }>({});
  // Kandidaten sollen Dokumente im Mein-Profil jederzeit austauschen/ergänzen können.
  const docsReadOnly = false;

  // Nach Speichern liefert der Parent die Server-Antwort (z. B. isPublished false) — Formular angleichen
  useEffect(() => {
    setFormData(profile);
    setExperienceYearsInput(
      profile.experienceYears !== undefined && profile.experienceYears !== null
        ? String(profile.experienceYears)
        : ''
    );
  }, [profile.userId, profile.updatedAt]);

  // Load documents on mount
  useEffect(() => {
    const loadDocs = async () => {
      const docs = await candidateService.getOriginalDocuments(profile.userId);
      if (docs) setDocuments(docs);
    };
    loadDocs();
  }, [profile.userId]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error on change
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (name === 'salaryWishEur' || name === 'workRadiusKm') {
      const trimmed = value.trim();
      const parsed = Number.parseInt(trimmed, 10);
      setFormData(prev => ({ ...prev, [name]: trimmed === '' || !Number.isFinite(parsed) ? null : parsed }));
      return;
    }
    setFormData(prev => ({ ...prev, [name]: Number.parseInt(value, 10) || 0 }));
  };

  const handleExperienceYearsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 3);
    setExperienceYearsInput(digits);
    if (digits === '') {
      setFormData((prev) => ({ ...prev, experienceYears: 0 }));
    } else {
      const n = Number.parseInt(digits, 10);
      if (Number.isFinite(n)) {
        setFormData((prev) => ({ ...prev, experienceYears: Math.min(99, Math.max(0, n)) }));
      }
    }
  };

  const handleExperienceYearsBlur = () => {
    if (experienceYearsInput.trim() === '') {
      setExperienceYearsInput('0');
      setFormData((prev) => ({ ...prev, experienceYears: 0 }));
      return;
    }
    const n = Number.parseInt(experienceYearsInput.replace(/\D/g, ''), 10);
    const clamped = Number.isFinite(n) ? Math.min(99, Math.max(0, n)) : 0;
    setExperienceYearsInput(String(clamped));
    setFormData((prev) => ({ ...prev, experienceYears: clamped }));
  };

  const currentWorkUmkreisOption = (() => {
    const area = (formData.workArea || '').trim();
    if (area === 'Deutschlandweit' || area === 'International') return area;
    const radius = formData.workRadiusKm;
    if (radius !== null && radius !== undefined && Number.isFinite(radius) && radius > 0) {
      const option = `+${Math.round(radius)}`;
      return (WORK_UMKREIS_OPTIONS as readonly string[]).includes(option) ? option : '';
    }
    return '';
  })();

  const handleWorkUmkreisChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const option = e.target.value;
    const parsed = parseWorkUmkreisOption(option);
    setFormData((prev) => ({
      ...prev,
      workRadiusKm: parsed.workRadiusKm,
      workArea: parsed.workArea,
    }));
    if (errors.workRadiusKm) {
      setErrors((prev) => ({ ...prev, workRadiusKm: '' }));
    }
  };

  const handleAddSkill = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const val = newSkill.trim().replace(',', '');
      if (val && !formData.skills.includes(val)) {
        setFormData(prev => ({ ...prev, skills: [...prev.skills, val] }));
      }
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    setFormData(prev => ({ ...prev, skills: prev.skills.filter(s => s !== skill) }));
  };

  const toggleKeyword = (keyword: string) => {
    setFormData(prev => ({
      ...prev,
      boostedKeywords: prev.boostedKeywords.includes(keyword)
        ? prev.boostedKeywords.filter(k => k !== keyword)
        : [...prev.boostedKeywords, keyword]
    }));
  };

  const handleCvUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const result = await documentService.uploadPdf(files[0]);
    if (result.success && result.data && result.name) {
      setDocuments(prev => ({ ...prev, cvPdf: { name: result.name!, data: result.data! } }));
      setDocumentFieldErrors(prev => ({ ...prev, cv: undefined }));
    }
  };

  const handleCertificatesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const results = await documentService.uploadMultiplePdfs(files);
    setDocuments(prev => ({ ...prev, certificates: [...prev.certificates, ...results] }));
  };

  const handleQualificationsUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const results = await documentService.uploadMultiplePdfs(files);
    setDocuments(prev => {
      const next = { ...prev, qualifications: [...prev.qualifications, ...results] };
      if (next.qualifications.length > 0) {
        setDocumentFieldErrors(er => ({ ...er, qualifications: undefined }));
      }
      return next;
    });
  };

  // Validate required fields
  const validateRequiredFields = (): Record<string, string> => {
    const newErrors: Record<string, string> = {};

    if (!formData.firstName?.trim()) newErrors.firstName = 'Pflichtfeld';
    if (!formData.lastName?.trim()) newErrors.lastName = 'Pflichtfeld';
    if (!formData.profession?.trim()) newErrors.profession = 'Pflichtfeld';
    if (!formData.city?.trim()) newErrors.city = 'Pflichtfeld';
    if (!formData.country?.trim()) newErrors.country = 'Pflichtfeld';
    if (!formData.industry?.trim()) newErrors.industry = 'Pflichtfeld';
    if (!formData.availability?.trim()) newErrors.availability = 'Pflichtfeld';
    if (formData.salaryWishEur === null || formData.salaryWishEur === undefined || formData.salaryWishEur <= 0) {
      newErrors.salaryWishEur = 'Pflichtfeld';
    }
    const hasRadius =
      formData.workRadiusKm !== null &&
      formData.workRadiusKm !== undefined &&
      Number.isFinite(formData.workRadiusKm) &&
      formData.workRadiusKm >= 0;
    const hasArea = !!formData.workArea?.trim();
    if (!hasRadius && !hasArea) {
      newErrors.workRadiusKm = 'Pflichtfeld';
    }

    return newErrors;
  };

  const handleSubmit = async (sendToRecruiter: boolean = false) => {
    // For sending to recruiter, validate all required fields + Dokumente
    if (sendToRecruiter) {
      const missingProfile = validateProfileForPublishing(formData);
      const missingDocs = validateDocumentsForRecruiterSubmit(documents);
      setDocumentFieldErrors({
        cv: missingDocs.includes('Lebenslauf (PDF)') ? 'Pflichtfeld beim Absenden an den Recruiter' : undefined,
        qualifications: missingDocs.includes('Qualifikationen (mindestens ein PDF)')
          ? 'Pflichtfeld beim Absenden an den Recruiter (mind. eine Datei)'
          : undefined
      });
      if (missingProfile.length > 0 || missingDocs.length > 0) {
        setMissingFields([...missingProfile, ...missingDocs]);
        setShowPublishWarning(true);
        return;
      }
      setDocumentFieldErrors({});
    } else {
      setDocumentFieldErrors({});
    }

    setIsSaving(true);
    try {
      const updatedProfile = {
        ...formData,
        // Candidate cannot publish directly; recruiter must approve.
        isPublished: sendToRecruiter ? false : !!formData.isPublished,
        isSubmitted: sendToRecruiter ? true : (formData.isSubmitted ?? false),
        status: sendToRecruiter ? CandidateStatus.REVIEW : formData.status,
        updatedAt: new Date().toISOString()
      };

      // Save documents
      await candidateService.updateDocuments(documents);

      // Save profile
      onSave(updatedProfile);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#101B31] pb-24 text-white antialiased">
      {/* Wie LandingPage: dunkelblau + dezentes Orange-Glow */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-[#101B31]" aria-hidden />
      <div
        className="pointer-events-none fixed top-1/4 -right-1/4 z-0 h-[600px] w-[600px] rounded-full bg-orange-500/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none fixed bottom-0 left-0 z-0 h-px w-full bg-gradient-to-r from-transparent via-white/15 to-transparent"
        aria-hidden
      />
      {/* Publish Warning Modal */}
      {showPublishWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
                </svg>
              </div>
              <h3 className="text-xl font-black text-slate-900">Pflichtfelder fehlen</h3>
            </div>
            <p className="text-slate-600 mb-4">
              Um dein Profil an den Recruiter zu senden, müssen alle Pflichtfelder ausgefüllt sein – inklusive{' '}
              <strong>Lebenslauf</strong> und mindestens einer <strong>Qualifikation</strong> (jeweils als PDF):
            </p>
            <ul className="bg-orange-50 rounded-xl p-4 mb-6">
              {missingFields.map(field => (
                <li key={field} className="flex items-center gap-2 text-orange-700 font-bold text-sm py-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                  </svg>
                  {field}
                </li>
              ))}
            </ul>
            <div className="flex gap-4">
              <Button variant="outline" className="flex-1" onClick={() => setShowPublishWarning(false)}>Schließen</Button>
              <Button variant="primary" className="flex-1" onClick={() => { setShowPublishWarning(false); handleSubmit(false); }}>Als Entwurf speichern</Button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal (DSGVO) */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9 7V4a1 1 0 011-1h4a1 1 0 011 1v3M4 7h16"></path>
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-black text-slate-900">Konto endgültig löschen</h3>
                <p className="text-slate-600 text-sm mt-1">
                  Deine Daten (Profil, Skills, Links, Dokumente) werden dauerhaft gelöscht. Das kann nicht rückgängig gemacht werden.
                </p>
              </div>
            </div>

            {deleteError && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-100 rounded-xl text-sm font-bold text-rose-700">
                {deleteError}
              </div>
            )}

            <Input
              label="Zur Bestätigung tippe: LÖSCHEN"
              type="text"
              placeholder="LÖSCHEN"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              className="h-10 text-sm rounded-xl"
            />

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeleteError(''); }}
                disabled={isDeleting}
              >
                Abbrechen
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                isLoading={isDeleting}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'LÖSCHEN'}
                onClick={async () => {
                  setIsDeleting(true);
                  setDeleteError('');
                  try {
                    const res = await authService.deleteMyAccount();
                    if (!res.success) {
                      setDeleteError(res.error || 'Konto konnte nicht gelöscht werden.');
                      return;
                    }
                    setShowDeleteModal(false);
                    onLogout();
                    onNavigate('/');
                  } finally {
                    setIsDeleting(false);
                  }
                }}
              >
                Konto löschen
              </Button>
            </div>
          </div>
        </div>
      )}

      <header className="relative border-b border-slate-200/80 bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex shrink-0 justify-center overflow-visible sm:justify-start">
              <CmsLogoHeroBadge variant="compact" className="!justify-center sm:!justify-start" />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
            {/* Mobile: icon-only, Desktop: text link */}
            <button
              onClick={() => onNavigate('/talents')}
              className="inline-flex sm:hidden items-center justify-center h-9 w-9 rounded-xl border border-slate-200 text-slate-600 transition-colors hover:border-blue-950/25 hover:text-blue-950"
              aria-label="Zurück zum Marktplatz"
              title="Zurück zum Marktplatz"
              type="button"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path>
              </svg>
            </button>
            <button
              onClick={() => onNavigate('/talents')}
              className="hidden sm:inline-flex rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-600 transition-colors hover:bg-blue-950/5 hover:text-blue-950"
              type="button"
            >
              Zum Marktplatz
            </button>

            <Button
              variant="ghost"
              size="sm"
              className="rounded-xl px-3 py-2 text-xs text-slate-600 hover:text-blue-950"
              onClick={onLogout}
            >
              Abmelden
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="rounded-xl border border-orange-300/90 !bg-gradient-to-r from-white via-orange-100 to-orange-400 px-4 py-2 text-xs font-bold !text-black shadow-md shadow-orange-500/25 transition-all hover:!bg-gradient-to-r hover:from-orange-50 hover:via-orange-200 hover:to-orange-500 hover:!text-black active:!text-black focus-visible:!text-black disabled:!text-black"
              onClick={() => handleSubmit(formData.isPublished)}
              isLoading={isSaving}
            >
              Speichern
            </Button>
          </div>
        </div>
      </header>

      <main className="relative z-10 mx-auto mt-6 max-w-5xl px-4 sm:mt-10 sm:px-6">
        <div className="relative z-10 mb-6 sm:mb-8">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.32em] text-orange-300/90 sm:text-[11px]">
            Kandidatenbereich
          </p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-white sm:text-4xl">
            Mein{' '}
            <span className="bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500 bg-clip-text text-transparent">
              Profil
            </span>
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
            Pflege deine Daten, Dokumente und Matching-Signale – präzise, sicher, recruiter-ready.
          </p>
        </div>

        {/* Required fields notice */}
        <div className={`${PROFILE_CARD} relative mb-6 flex items-start gap-4 p-4 sm:mb-10 sm:p-6`}>
          <ProfileCardGlow />
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-orange-600 text-white shadow-lg shadow-orange-500/35 sm:h-12 sm:w-12">
            <svg className="h-5 w-5 sm:h-6 sm:w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div className="relative">
            <h4 className="font-black tracking-tight text-slate-900">Pflichtfelder</h4>
            <p className="mt-1 text-xs leading-relaxed text-slate-600 sm:text-sm">
              Felder mit <span className="font-black text-orange-600">*</span> sind erforderlich, um dein Profil an den Recruiter zu senden.
            </p>
          </div>
        </div>

        <div className="space-y-5 sm:space-y-8">
          {/* Identity Section */}
          <section className={`${PROFILE_CARD} p-5 sm:p-8 md:p-10`} style={SECTION_RENDER_HINT}>
            <ProfileCardGlow />
            <div className="relative flex flex-col items-center gap-3.5 md:flex-row md:gap-10 sm:gap-8">
              <div className="relative">
                <Avatar
                  seed={`${formData.firstName || ''}${formData.lastName || ''}` || formData.userId || 'user'}
                  size="md"
                  className="w-16 h-16 text-lg shadow-md ring-[5px] ring-orange-100 ring-offset-2 ring-offset-white sm:w-32 sm:h-32 sm:text-3xl sm:ring-[10px]"
                  imageUrl={formData.profileImageUrl}
                />
              </div>
              <div className="relative w-full flex-1 space-y-3 sm:space-y-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:mb-1.5 sm:text-sm">
                      Vorname
                      <RequiredBadge />
                    </label>
                    <Input
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      placeholder="Max"
                      error={errors.firstName}
                      className="h-9 rounded-xl text-sm sm:h-10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:mb-1.5 sm:text-sm">
                      Nachname
                      <RequiredBadge />
                    </label>
                    <Input
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      placeholder="Mustermann"
                      error={errors.lastName}
                      className="h-9 rounded-xl text-sm sm:h-10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:mb-1.5 sm:text-sm">
                      Stadt
                      <RequiredBadge />
                    </label>
                    <Input
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      placeholder="Berlin"
                      error={errors.city}
                      className="h-9 rounded-xl text-sm sm:h-10"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:mb-1.5 sm:text-sm">
                      Land
                      <RequiredBadge />
                    </label>
                    <Input
                      name="country"
                      value={formData.country}
                      onChange={handleChange}
                      placeholder="Deutschland"
                      error={errors.country}
                      className="h-9 rounded-xl text-sm sm:h-10"
                    />
                  </div>
                </div>

                {/* PRIVATE CONTACT INFO */}
                <div className="mt-3 border-t border-orange-200/60 pt-3 sm:mt-6 sm:pt-6">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2 sm:gap-6">
                    <div>
                      <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:mb-1.5 sm:text-sm">Straße & Hausnummer</label>
                      <Input name="address" value={formData.address || ''} onChange={handleChange} placeholder="Musterstraße 1" className="h-9 rounded-xl text-sm sm:h-10" />
                    </div>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:mb-1.5 sm:text-sm">PLZ</label>
                        <Input name="zipCode" value={formData.zipCode || ''} onChange={handleChange} placeholder="12345" className="h-9 rounded-xl text-sm sm:h-10" />
                      </div>
                      <div>
                        <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:mb-1.5 sm:text-sm">Telefon</label>
                        <Input name="phoneNumber" value={formData.phoneNumber || ''} onChange={handleChange} placeholder="+49 123..." className="h-9 rounded-xl text-sm sm:h-10" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 sm:mt-6 sm:grid-cols-3 sm:gap-6">
                  <Input
                    label="Geburtsjahr"
                    name="birthYear"
                    type="number"
                    value={formData.birthYear || ''}
                    onChange={handleChange}
                    placeholder="1990"
                    min="1940"
                    max={new Date().getFullYear() - 16}
                    className="h-9 rounded-xl text-sm sm:h-10"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Details Section – BERUFLICHER FOKUS */}
          <section className={`${PROFILE_CARD} p-5 sm:p-8 md:p-10`} style={SECTION_RENDER_HINT}>
            <ProfileCardGlow />
            <h3 className="relative mb-6 flex items-center gap-3 text-base font-black tracking-tight text-slate-900 sm:mb-8 sm:text-xl">
              <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-orange-500 via-amber-500 to-orange-600 shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
              BERUFLICHER FOKUS
            </h3>
            <div className="relative mb-5 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-8">
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:text-sm">
                  Beruf
                  <RequiredBadge />
                </label>
                <Input
                  name="profession"
                  value={formData.profession ?? ''}
                  onChange={handleChange}
                  placeholder="z. B. Schweißer"
                  error={errors.profession}
                  className="h-9 rounded-xl text-sm sm:h-10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:text-sm">
                  Hauptbranche
                  <RequiredBadge />
                </label>
                <Select
                  name="industry"
                  value={formData.industry}
                  onChange={handleChange}
                  error={errors.industry}
                  className="h-9 rounded-xl text-sm sm:h-10"
                >
                  <option value="">Branche wählen...</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </Select>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:text-sm">
                  Erfahrung (Jahre)
                  <RequiredBadge />
                </label>
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  name="experienceYears"
                  value={experienceYearsInput}
                  onChange={handleExperienceYearsChange}
                  onBlur={handleExperienceYearsBlur}
                  placeholder="z. B. 5"
                  className="h-9 rounded-xl text-sm sm:h-10"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-bold text-slate-900 sm:text-sm">
                  Verfügbarkeit
                  <RequiredBadge />
                </label>
                <Select
                  name="availability"
                  value={formData.availability}
                  onChange={handleChange}
                  error={errors.availability}
                  className="h-9 rounded-xl text-sm sm:h-10"
                >
                  <option value="">Status wählen...</option>
                  {AVAILABILITY_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              </div>
            </div>

            <div className="relative mt-5">
              <h3 className="mb-4 flex items-center gap-2 text-base font-black tracking-tight text-slate-900 sm:text-lg">
                <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-orange-500 via-amber-500 to-orange-600 shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
                ARBEITSRAUM & GEHALT
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
                <Input
                  label="Gehaltswunsch (EUR) *"
                  labelClassName="text-slate-900 font-bold"
                  name="salaryWishEur"
                  type="number"
                  value={formData.salaryWishEur && formData.salaryWishEur > 0 ? formData.salaryWishEur : ''}
                  onChange={handleNumberChange}
                  placeholder="z. B. 45000"
                  min="1"
                  error={errors.salaryWishEur}
                  className="h-9 rounded-xl text-sm sm:h-10"
                />
                <Select
                  label="Arbeitsradius / Einsatzgebiet *"
                  labelClassName="text-slate-900 font-bold"
                  name="workUmkreis"
                  value={currentWorkUmkreisOption}
                  onChange={handleWorkUmkreisChange}
                  error={errors.workRadiusKm}
                  className="h-9 rounded-xl text-sm sm:h-10"
                >
                  <option value="">Option wählen…</option>
                  {WORK_UMKREIS_OPTIONS.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="relative">
              <Textarea
                label="Kurz-Bio (optional)"
                name="about"
                placeholder="Beschreiben Sie kurz Ihren beruflichen Hintergrund…"
                value={formData.about || ''}
                onChange={handleChange}
                labelClassName="text-slate-900 font-bold"
                className="min-h-[120px] rounded-xl text-sm"
              />
            </div>

            <div className="relative mt-4">
              <Textarea
                label="Sprachen (optional)"
                name="languages"
                placeholder="z. B. Deutsch (Muttersprache), Englisch (C1), Französisch (Grundkenntnisse)"
                value={formData.languages ?? ''}
                onChange={handleChange}
                labelClassName="text-slate-900 font-bold"
                className="min-h-[100px] rounded-xl text-sm"
              />
              <p className="mt-1.5 text-xs font-medium text-slate-500">
                Welche Sprachen du beherrschst – frei formuliert, inkl. Niveau wenn du möchtest.
              </p>
            </div>
          </section>

          {/* Skills & Matching-Boost */}
          <section className={`${PROFILE_CARD} p-5 sm:p-8 md:p-10`} style={SECTION_RENDER_HINT}>
            <ProfileCardGlow />
            <div className="relative z-10">
              <div className="mb-8 flex flex-col gap-5 lg:mb-10 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-2xl">
                  <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.28em] text-orange-600/90 sm:text-[11px]">
                    Matching · Sichtbarkeit
                  </p>
                  <h3 className="text-2xl font-black leading-tight tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
                    Skills &{' '}
                    <span className="bg-gradient-to-r from-orange-600 to-amber-500 bg-clip-text text-transparent">Matching-Boost</span>
                  </h3>
                  <p className="mt-3 text-sm font-medium leading-relaxed text-slate-600 sm:text-base">
                    Optional – ergänze Skills und Booster für besseres Recruiter-Matching.
                  </p>
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-orange-900 shadow-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-50" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
                    </span>
                    Profil aktiv
                  </span>
                </div>
              </div>

              <div className="space-y-8 sm:space-y-10">
                <div className="rounded-2xl border border-orange-200/80 bg-gradient-to-br from-white to-orange-50/90 p-5 shadow-sm sm:p-7">
                  <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-orange-800">
                    <span className="h-px w-10 bg-gradient-to-r from-orange-500 via-amber-400 to-orange-300" />
                    Fachliche Skills
                  </div>
                  <Input
                    label="Skills hinzufügen"
                    placeholder="Eingeben & Enter — z. B. SAP, Rohrleitungsbau, BIM"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyDown={handleAddSkill}
                    labelClassName="text-slate-900 font-bold"
                    className="h-11 rounded-xl border-slate-200"
                  />
                  <div className="mt-4 flex flex-wrap gap-2">
                    {formData.skills.map((skill) => (
                      <span
                        key={skill}
                        className="inline-flex items-center gap-2 rounded-xl border border-orange-200/90 bg-white px-3 py-1.5 text-xs font-bold text-orange-950 shadow-sm transition-all hover:border-orange-400 sm:text-sm"
                      >
                        {skill}
                        <button
                          type="button"
                          onClick={() => removeSkill(skill)}
                          className="rounded-md px-1 text-lg leading-none text-orange-600/70 transition-colors hover:bg-orange-50 hover:text-orange-900"
                          aria-label={`${skill} entfernen`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-6 flex items-center gap-3">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-300/80 to-transparent" />
                    <span className="shrink-0 bg-gradient-to-r from-orange-700 to-amber-600 bg-clip-text text-center text-[10px] font-black uppercase tracking-[0.28em] text-transparent">
                      Sichtbarkeits-Booster
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent via-orange-300/80 to-transparent" />
                  </div>
                  <p className="mb-6 text-center text-xs font-semibold text-slate-500">Zum Aktivieren antippen</p>

                  <div className="space-y-5 sm:space-y-6">
                    {BOOSTER_KEYWORD_CATEGORIES.map((cat) => (
                      <div
                        key={cat.title}
                        className={`rounded-2xl border p-4 shadow-sm backdrop-blur-sm transition-all sm:p-5 ${
                          cat.panelVariant === 'orange'
                            ? 'border-orange-400/70 bg-gradient-to-br from-orange-100 via-amber-50 to-orange-50 hover:border-orange-500'
                            : 'border-orange-200/70 bg-white/90 hover:border-orange-300'
                        }`}
                      >
                        <h4 className="mb-3 flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-900 sm:text-[11px]">
                          <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 shadow-[0_0_10px_rgba(249,115,22,0.45)]" />
                          {cat.title}
                        </h4>
                        <div className="flex flex-wrap gap-2">
                          {cat.keywords.map((kw) => {
                            const active = formData.boostedKeywords.includes(kw);
                            return (
                              <button
                                key={`${cat.title}::${kw}`}
                                type="button"
                                onClick={() => toggleKeyword(kw)}
                                className={`rounded-xl px-3 py-2 text-[9px] font-black uppercase tracking-wide transition-all duration-200 sm:px-3.5 sm:py-2 sm:text-[10px] ${
                                  active
                                    ? 'border border-orange-500 bg-gradient-to-br from-[#101B31] via-slate-800 to-orange-600 text-white shadow-md shadow-orange-500/25'
                                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:border-orange-300 hover:bg-orange-50/80 hover:text-slate-900'
                                }`}
                              >
                                {kw.toUpperCase()}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* Documents Section */}
          <section className={`${PROFILE_CARD} p-4 sm:p-8 md:p-10`} style={SECTION_RENDER_HINT}>
            <ProfileCardGlow />
            <h3 className="relative mb-4 flex flex-wrap items-center gap-3 text-base font-black text-slate-900 sm:mb-8 sm:text-xl">
              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-orange-500 via-amber-500 to-orange-600 shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
              <span>DOKUMENTE</span>
              <span className="rounded-lg border border-orange-200/80 bg-orange-50/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-orange-900 sm:text-xs">
                Zertifikate optional
              </span>
            </h3>

            {docsReadOnly ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-6">
                  <div className="rounded-2xl border border-orange-200/80 bg-white/70 p-4">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Lebenslauf (CV) – Original</h4>
                    {documents.cvPdf ? (
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-bold text-slate-700 truncate max-w-[180px]">{documents.cvPdf.name}</span>
                        <a href={documents.cvPdf.data} download={documents.cvPdf.name} className="px-3 py-2 bg-orange-100 hover:bg-orange-200 rounded-xl text-xs font-black text-orange-700">
                          Download
                        </a>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Kein CV</div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-orange-200/80 bg-white/70 p-4">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Zertifikate – Originale</h4>
                    <div className="space-y-2">
                      {documents.certificates?.length ? (
                        documents.certificates.map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-slate-700 truncate">{doc.name}</span>
                            <a href={doc.data} download={doc.name} className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 rounded-lg text-[10px] font-black text-orange-700">
                              ↓
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 italic">Keine</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-orange-200/80 bg-white/70 p-4">
                    <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Qualifikationen – Originale</h4>
                    <div className="space-y-2">
                      {documents.qualifications?.length ? (
                        documents.qualifications.map((doc, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-3">
                            <span className="text-xs font-bold text-slate-700 truncate">{doc.name}</span>
                            <a href={doc.data} download={doc.name} className="px-2.5 py-1.5 bg-orange-100 hover:bg-orange-200 rounded-lg text-[10px] font-black text-orange-700">
                              ↓
                            </a>
                          </div>
                        ))
                      ) : (
                        <div className="text-xs text-slate-400 italic">Keine</div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="rounded-2xl border border-orange-200/70 bg-orange-50/40 p-4 text-xs font-medium text-slate-700">
                  Deine Originaldokumente sind eingefroren (nur Download). Der Recruiter kann danach „bearbeitete Dokumente“ für den Marktplatz hinzufügen/ersetzen.
                </div>
              </div>
            ) : (
              <div className="relative grid grid-cols-1 gap-4 md:grid-cols-3 sm:gap-6">
                <FileUpload
                  label="Lebenslauf (CV)"
                  required
                  accept="application/pdf"
                  onChange={handleCvUpload}
                  files={documents.cvPdf ? [{ name: documents.cvPdf.name }] : []}
                  onRemove={() => {
                    setDocuments(prev => ({ ...prev, cvPdf: undefined }));
                  }}
                  helperText="PDF, max 10MB"
                  error={documentFieldErrors.cv}
                />

                <FileUpload
                  label="Zertifikate"
                  accept="application/pdf"
                  multiple
                  onChange={handleCertificatesUpload}
                  files={documents.certificates}
                  onRemove={(idx) => setDocuments(prev => ({ ...prev, certificates: prev.certificates.filter((_, i) => i !== idx) }))}
                  helperText="PDFs, max 10MB – freiwillig"
                />

                <FileUpload
                  label="Qualifikationen"
                  required
                  accept="application/pdf"
                  multiple
                  onChange={handleQualificationsUpload}
                  files={documents.qualifications}
                  onRemove={(idx) =>
                    setDocuments(prev => ({ ...prev, qualifications: prev.qualifications.filter((_, i) => i !== idx) }))
                  }
                  helperText="PDFs, max 10MB – mindestens eine Datei"
                  error={documentFieldErrors.qualifications}
                />
              </div>
            )}
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:gap-4 sm:pt-4">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 rounded-2xl border-2 border-blue-950/20 py-4 font-bold text-blue-950 shadow-sm transition-all hover:border-blue-900/40 hover:bg-blue-950/[0.04] sm:py-5"
              onClick={() => handleSubmit(false)}
              isLoading={isSaving}
            >
              Entwurf speichern
            </Button>
            <Button
              size="lg"
              variant="primary"
              className="flex-1 rounded-2xl border border-orange-300/90 !bg-gradient-to-r from-white via-orange-100 to-orange-400 py-4 text-base font-black uppercase tracking-widest !text-black shadow-lg shadow-orange-500/30 transition-all hover:!bg-gradient-to-r hover:from-orange-50 hover:via-orange-200 hover:to-orange-500 hover:!text-black active:!text-black focus-visible:!text-black disabled:!text-black sm:py-5 sm:text-lg"
              onClick={() => handleSubmit(true)}
              isLoading={isSaving}
            >
              Zum Recruiter senden
            </Button>
          </div>

          {/* DSGVO: Account deletion */}
          <div className="mt-8 sm:mt-10">
            <div className={`${PROFILE_CARD} p-5 sm:p-6`}>
              <ProfileCardGlow />
              <div className="relative flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm font-black text-slate-900 sm:text-base">Konto löschen</h4>
                  <p className="mt-1 text-xs text-slate-600 sm:text-sm">
                    Du kannst dein Konto jederzeit dauerhaft löschen (DSGVO).
                  </p>
                </div>
                <Button
                  variant="danger"
                  className="h-10 shrink-0 rounded-xl px-4 text-xs sm:text-sm"
                  onClick={() => setShowDeleteModal(true)}
                >
                  Löschen
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CandidateProfilePage;
