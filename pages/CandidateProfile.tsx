
import React, { useState, useEffect } from 'react';
import { CandidateProfile, CandidateStatus, CandidateDocuments, SocialLink, validateProfileForPublishing, validateDocumentsForRecruiterSubmit, canPublishProfile } from '../types';
import { Button, Input, Select, Avatar, Textarea, FileUpload } from '../components/UI';
import { INDUSTRIES, AVAILABILITY_OPTIONS, BOOSTER_KEYWORD_CATEGORIES } from '../constants';
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

const CandidateProfilePage: React.FC<CandidateProfileProps> = ({ profile, onNavigate, onSave, onLogout }) => {
  const [formData, setFormData] = useState<CandidateProfile>(profile);
  const [documents, setDocuments] = useState<CandidateDocuments>({
    userId: profile.userId,
    certificates: [],
    qualifications: []
  });
  const [newSkill, setNewSkill] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showPublishWarning, setShowPublishWarning] = useState(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  /** Pflichtfeld-Hinweise für Lebenslauf / Qualifikationen beim Absenden an Recruiter */
  const [documentFieldErrors, setDocumentFieldErrors] = useState<{ cv?: string; qualifications?: string }>({});

  // Load documents on mount
  useEffect(() => {
    const loadDocs = async () => {
      const docs = await candidateService.getDocuments(profile.userId);
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
    setFormData(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
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

  const handleAddLink = () => {
    if (newLink.label && newLink.url) {
      setFormData(prev => ({
        ...prev,
        socialLinks: [...prev.socialLinks, { ...newLink }]
      }));
      setNewLink({ label: '', url: '' });
    }
  };

  const removeLink = (index: number) => {
    setFormData(prev => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, i) => i !== index)
    }));
  };

  const handleProfileImageUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const result = await documentService.uploadProfileImage(files[0]);
    if (result.success && result.data) {
      setFormData(prev => ({ ...prev, profileImageUrl: result.data }));
    }
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
    if (!formData.city?.trim()) newErrors.city = 'Pflichtfeld';
    if (!formData.country?.trim()) newErrors.country = 'Pflichtfeld';
    if (!formData.industry?.trim()) newErrors.industry = 'Pflichtfeld';
    if (!formData.availability?.trim()) newErrors.availability = 'Pflichtfeld';

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
              label="Passwort bestätigen"
              type="password"
              placeholder="••••••••"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="h-10 text-sm rounded-xl"
            />
            <div className="mt-4">
              <Input
                label="Zur Bestätigung tippe: LÖSCHEN"
                type="text"
                placeholder="LÖSCHEN"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="h-10 text-sm rounded-xl"
              />
            </div>

            <div className="flex gap-3 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowDeleteModal(false); setDeletePassword(''); setDeleteConfirmText(''); setDeleteError(''); }}
                disabled={isDeleting}
              >
                Abbrechen
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                isLoading={isDeleting}
                disabled={!deletePassword || deleteConfirmText.trim().toUpperCase() !== 'LÖSCHEN'}
                onClick={async () => {
                  setIsDeleting(true);
                  setDeleteError('');
                  try {
                    const res = await authService.deleteMyAccount(deletePassword);
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

      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white shadow-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 sm:py-0 sm:h-[4.25rem] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/1adef99a-1986-43bc-acb8-278472ee426c.png" alt="CMS Talents" className="h-12 w-auto object-contain shrink-0" />
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
              className="rounded-xl border-0 bg-gradient-to-r from-blue-950 via-blue-900 to-orange-600 px-4 py-2 text-xs shadow-md shadow-blue-950/25 transition-all hover:bg-transparent hover:from-blue-900 hover:via-blue-800 hover:to-orange-500 active:bg-transparent"
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
          <section className={`${PROFILE_CARD} p-5 sm:p-8 md:p-10`}>
            <ProfileCardGlow />
            <div className="relative flex flex-col items-center gap-3.5 md:flex-row md:gap-10 sm:gap-8">
              <div className="relative">
                <Avatar
                  seed={formData.firstName + formData.lastName || 'user'}
                  size="md"
                  className="w-16 h-16 text-lg shadow-md ring-[5px] ring-orange-100 ring-offset-2 ring-offset-white sm:w-32 sm:h-32 sm:text-3xl sm:ring-[10px]"
                  imageUrl={formData.profileImageUrl}
                />
                <label className="absolute -bottom-2 -right-2 cursor-pointer rounded-2xl bg-gradient-to-br from-[#101B31] to-slate-900 p-2 text-orange-400 shadow-lg transition-transform hover:scale-105 hover:text-orange-300">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleProfileImageUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
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
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6">
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
          <section className={`${PROFILE_CARD} p-5 sm:p-8 md:p-10`}>
            <ProfileCardGlow />
            <h3 className="relative mb-6 flex items-center gap-3 text-base font-black tracking-tight text-slate-900 sm:mb-8 sm:text-xl">
              <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-orange-500 via-amber-500 to-orange-600 shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
              BERUFLICHER FOKUS
            </h3>
            <div className="relative mb-5 grid grid-cols-1 gap-4 sm:mb-8 sm:grid-cols-2 sm:gap-8">
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
                  type="number"
                  name="experienceYears"
                  value={formData.experienceYears}
                  onChange={handleNumberChange}
                  min="0"
                  max="50"
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
          </section>

          {/* Skills & Matching-Boost */}
          <section className={`${PROFILE_CARD} p-5 sm:p-8 md:p-10`}>
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

          {/* Social Links Section */}
          <section className={`${PROFILE_CARD} p-5 sm:p-8 md:p-10`}>
            <ProfileCardGlow />
            <h3 className="relative mb-6 flex flex-wrap items-center gap-3 text-base font-black tracking-tight text-slate-900 sm:mb-8 sm:text-xl">
              <span className="h-8 w-1.5 rounded-full bg-gradient-to-b from-orange-500 via-amber-500 to-orange-600 shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
              SOCIAL LINKS{' '}
              <span className="text-sm font-bold normal-case tracking-normal text-slate-500">(optional)</span>
            </h3>

            {/* Existing links */}
            {formData.socialLinks.length > 0 && (
              <div className="relative mb-4 space-y-2 sm:mb-6 sm:space-y-3">
                {formData.socialLinks.map((link, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 rounded-xl border border-orange-200/70 bg-white/90 p-3 sm:gap-4 sm:p-4"
                  >
                    <span className="text-sm font-bold text-slate-800">{link.label}:</span>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 truncate text-orange-700 underline-offset-2 hover:text-orange-900 hover:underline"
                    >
                      {link.url}
                    </a>
                    <button type="button" onClick={() => removeLink(idx)} className="text-slate-400 hover:text-red-600">
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new link */}
            <div className="relative grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-4">
              <Select value={newLink.label} onChange={(e) => setNewLink(prev => ({ ...prev, label: e.target.value }))} className="h-9 rounded-xl text-sm sm:h-10">
                <option value="">Typ wählen...</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="GitHub">GitHub</option>
                <option value="Portfolio">Portfolio</option>
                <option value="Website">Website</option>
                <option value="Xing">Xing</option>
                <option value="Andere">Andere</option>
              </Select>
              <Input
                placeholder="https://..."
                value={newLink.url}
                onChange={(e) => setNewLink(prev => ({ ...prev, url: e.target.value }))}
                className="h-9 rounded-xl text-sm sm:h-10"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddLink}
                disabled={!newLink.label || !newLink.url}
                className="h-9 rounded-xl border-orange-200 text-sm text-slate-800 hover:border-orange-400 hover:bg-orange-50 sm:h-10"
              >
                Link hinzufügen
              </Button>
            </div>
          </section>

          {/* Documents Section */}
          <section className={`${PROFILE_CARD} p-4 sm:p-8 md:p-10`}>
            <ProfileCardGlow />
            <h3 className="relative mb-4 flex flex-wrap items-center gap-3 text-base font-black text-slate-900 sm:mb-8 sm:text-xl">
              <span className="h-8 w-1.5 shrink-0 rounded-full bg-gradient-to-b from-orange-500 via-amber-500 to-orange-600 shadow-[0_0_18px_rgba(249,115,22,0.45)]" />
              <span>DOKUMENTE</span>
              <span className="rounded-lg border border-orange-200/80 bg-orange-50/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-orange-900 sm:text-xs">
                Zertifikate optional
              </span>
            </h3>

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
                darkSurface
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
              className="flex-1 rounded-2xl border-0 bg-gradient-to-r from-blue-950 via-blue-800 to-orange-600 py-4 text-base font-black uppercase tracking-widest shadow-lg shadow-blue-950/30 transition-all hover:bg-transparent hover:from-blue-900 hover:via-blue-700 hover:to-orange-500 active:bg-transparent sm:py-5 sm:text-lg"
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
