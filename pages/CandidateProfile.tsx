
import React, { useState, useEffect } from 'react';
import { CandidateProfile, CandidateStatus, CandidateDocuments, SocialLink, validateProfileForPublishing, validateDocumentsForRecruiterSubmit, canPublishProfile } from '../types';
import { Button, Input, Select, Avatar, Badge, Textarea, FileUpload } from '../components/UI';
import { INDUSTRIES, AVAILABILITY_OPTIONS, SUGGESTED_KEYWORDS } from '../constants';
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
  <span className="ml-1 text-orange-600 font-black text-xs">*</span>
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
    <div className="min-h-screen bg-[#101B31] pb-20">
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

      <header className="bg-white sticky top-0 z-30 shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-0 sm:h-20 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-0">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/1adef99a-1986-43bc-acb8-278472ee426c.png" alt="CMS Talents" className="h-12 w-auto object-contain shrink-0" />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-2 sm:gap-4">
            {/* Mobile: icon-only, Desktop: text link */}
            <button
              onClick={() => onNavigate('/talents')}
              className="inline-flex sm:hidden items-center justify-center h-9 w-9 rounded-xl border border-slate-200 text-slate-600 hover:text-orange-600 hover:border-slate-300 transition-colors"
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
              className="hidden sm:inline-flex text-xs font-black text-slate-600 hover:text-orange-600 transition-colors uppercase tracking-widest px-3 py-2 rounded-xl hover:bg-slate-50"
              type="button"
            >
              Zum Marktplatz
            </button>

            <Button
              variant="ghost"
              size="sm"
              className="text-slate-600 hover:text-orange-600 px-3 py-2 rounded-xl text-xs"
              onClick={onLogout}
            >
              Abmelden
            </Button>
            <Button
              size="sm"
              variant="primary"
              className="rounded-xl px-4 py-2 text-xs"
              onClick={() => handleSubmit(formData.isPublished)}
              isLoading={isSaving}
            >
              Speichern
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-2.5 sm:px-4 mt-4 sm:mt-12">
        {/* Required fields notice */}
        <div className="bg-orange-500 border border-orange-300/40 rounded-xl sm:rounded-2xl p-2.5 sm:p-6 mb-4 sm:mb-8 flex items-start gap-3 sm:gap-4 shadow-[0_18px_60px_-45px_rgba(0,0,0,0.75)]">
          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white/15 border border-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div>
            <h4 className="font-black text-white">Pflichtfelder</h4>
            <p className="text-xs sm:text-sm text-white/90">
              Felder mit <span className="text-white font-black">*</span> sind erforderlich, um dein Profil zu veröffentlichen.
            </p>
          </div>
        </div>

        <div className="space-y-3 sm:space-y-8">
          {/* Identity Section */}
          <section className="bg-white p-2.5 sm:p-8 md:p-10 rounded-xl sm:rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <div className="flex flex-col md:flex-row items-center gap-3.5 sm:gap-8 md:gap-10">
              <div className="relative">
                <Avatar
                  seed={formData.firstName + formData.lastName || 'user'}
                  size="md"
                  className="w-16 h-16 text-lg sm:w-32 sm:h-32 sm:text-3xl ring-[6px] sm:ring-[12px] ring-orange-50"
                  imageUrl={formData.profileImageUrl}
                />
                <label className="absolute -bottom-2 -right-2 p-2 bg-slate-900 text-orange-500 rounded-2xl shadow-xl cursor-pointer hover:bg-slate-800 transition-colors">
                  <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleProfileImageUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex-1 w-full space-y-3 sm:space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Vorname<RequiredBadge /></label>
                    <Input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="Max" error={errors.firstName} className="h-9 sm:h-10 text-sm rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Nachname<RequiredBadge /></label>
                    <Input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Mustermann" error={errors.lastName} className="h-9 sm:h-10 text-sm rounded-xl" />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Stadt<RequiredBadge /></label>
                    <Input name="city" value={formData.city} onChange={handleChange} placeholder="Berlin" error={errors.city} className="h-9 sm:h-10 text-sm rounded-xl" />
                  </div>
                  <div>
                    <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Land<RequiredBadge /></label>
                    <Input name="country" value={formData.country} onChange={handleChange} placeholder="Deutschland" error={errors.country} className="h-9 sm:h-10 text-sm rounded-xl" />
                  </div>
                </div>

                {/* PRIVATE CONTACT INFO */}
                <div className="mt-3 sm:mt-6 pt-3 sm:pt-6 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6">
                    <div>
                      <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Straße & Hausnummer</label>
                      <Input name="address" value={formData.address || ''} onChange={handleChange} placeholder="Musterstraße 1" className="h-9 sm:h-10 text-sm rounded-xl" />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">PLZ</label>
                        <Input name="zipCode" value={formData.zipCode || ''} onChange={handleChange} placeholder="12345" className="h-9 sm:h-10 text-sm rounded-xl" />
                      </div>
                      <div>
                        <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Telefon</label>
                        <Input name="phoneNumber" value={formData.phoneNumber || ''} onChange={handleChange} placeholder="+49 123..." className="h-9 sm:h-10 text-sm rounded-xl" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-6 mt-3 sm:mt-6">
                  <Input
                    label="Geburtsjahr"
                    name="birthYear"
                    type="number"
                    value={formData.birthYear || ''}
                    onChange={handleChange}
                    placeholder="1990"
                    min="1940"
                    max={new Date().getFullYear() - 16}
                    className="h-9 sm:h-10 text-sm rounded-xl"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Details Section */}
          <section className="bg-white p-2.5 sm:p-8 md:p-10 rounded-xl sm:rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-base sm:text-xl font-black text-slate-900 mb-4 sm:mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
              BERUFLICHER FOKUS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-8 mb-5 sm:mb-8">
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Hauptbranche<RequiredBadge /></label>
                <Select name="industry" value={formData.industry} onChange={handleChange} error={errors.industry} className="h-9 sm:h-10 text-sm rounded-xl">
                  <option value="">Branche wählen...</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Erfahrung (Jahre)<RequiredBadge /></label>
                <Input type="number" name="experienceYears" value={formData.experienceYears} onChange={handleNumberChange} min="0" max="50" className="h-9 sm:h-10 text-sm rounded-xl" />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-bold text-slate-900 mb-1 sm:mb-1.5">Verfügbarkeit<RequiredBadge /></label>
                <Select name="availability" value={formData.availability} onChange={handleChange} error={errors.availability} className="h-9 sm:h-10 text-sm rounded-xl">
                  <option value="">Status wählen...</option>
                  {AVAILABILITY_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}
                </Select>
              </div>
            </div>
            <Textarea
              label="Kurz-Bio (optional)"
              name="about"
              placeholder="Beschreiben Sie kurz Ihren beruflichen Hintergrund…"
              value={formData.about || ''}
              onChange={handleChange}
              className="text-sm rounded-xl min-h-[120px]"
            />
          </section>

          {/* Skills Section */}
          <section className="bg-white p-2.5 sm:p-8 md:p-10 rounded-xl sm:rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-base sm:text-xl font-black text-slate-900 mb-4 sm:mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
              SKILLS & MATCHING-BOOST (optional)
            </h3>
            <div className="space-y-4 sm:space-y-8">
              <div>
                <Input
                  label="Fachliche Skills"
                  placeholder="Skill eingeben & Enter drücken (z.B. React, SEO, SAP)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleAddSkill}
                  className="h-9 sm:h-10 text-sm rounded-xl"
                />
                <div className="flex flex-wrap gap-2 mt-3 sm:mt-4">
                  {formData.skills.map(skill => (
                    <Badge key={skill} variant="orange" className="gap-2 px-3 py-1.5 text-xs sm:text-sm shadow-sm border-orange-200">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-600 font-bold transition-colors">×</button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-3 sm:pt-6 border-t border-slate-50">
                <label className="text-[11px] sm:text-xs font-black text-slate-400 block mb-3 sm:mb-4 uppercase tracking-[0.2em]">Sichtbarkeits-Boosters (Klick zum Aktivieren)</label>
                <div className="flex flex-wrap gap-2.5 sm:gap-3">
                  {SUGGESTED_KEYWORDS.map(kw => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => toggleKeyword(kw)}
                      className={`px-3.5 sm:px-5 py-1.5 sm:py-2.5 rounded-xl text-[10px] sm:text-xs font-black transition-all border-2 ${formData.boostedKeywords.includes(kw) ? 'bg-slate-900 text-orange-500 border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'}`}
                    >
                      {kw.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Social Links Section */}
          <section className="bg-white p-2.5 sm:p-8 md:p-10 rounded-xl sm:rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-base sm:text-xl font-black text-slate-900 mb-4 sm:mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
              SOCIAL LINKS (optional)
            </h3>

            {/* Existing links */}
            {formData.socialLinks.length > 0 && (
              <div className="space-y-2 sm:space-y-3 mb-4 sm:mb-6">
                {formData.socialLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-3 sm:gap-4 bg-slate-50 p-2.5 sm:p-4 rounded-xl">
                    <span className="font-bold text-slate-700 text-sm">{link.label}:</span>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline truncate flex-1">{link.url}</a>
                    <button type="button" onClick={() => removeLink(idx)} className="text-slate-400 hover:text-red-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new link */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <Select value={newLink.label} onChange={(e) => setNewLink(prev => ({ ...prev, label: e.target.value }))} className="h-9 sm:h-10 text-sm rounded-xl">
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
                className="h-9 sm:h-10 text-sm rounded-xl"
              />
              <Button type="button" variant="outline" onClick={handleAddLink} disabled={!newLink.label || !newLink.url} className="h-9 sm:h-10 rounded-xl text-sm">
                Link hinzufügen
              </Button>
            </div>
          </section>

          {/* Documents Section */}
          <section className="bg-white p-2.5 sm:p-8 md:p-10 rounded-xl sm:rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-base sm:text-xl font-black text-slate-900 mb-4 sm:mb-8 flex items-center gap-3 flex-wrap">
              <span className="w-2 h-8 bg-orange-600 rounded-full shrink-0" />
              <span>DOKUMENTE</span>
              <span className="text-[10px] sm:text-xs font-black uppercase tracking-widest px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 border border-slate-200">
                Zertifikate optional
              </span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
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
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-6 pt-6 sm:pt-10">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 py-3.5 sm:py-5 rounded-xl sm:rounded-2xl border-2 border-slate-200"
              onClick={() => handleSubmit(false)}
              isLoading={isSaving}
            >
              Entwurf speichern
            </Button>
            <Button
              size="lg"
              variant="primary"
              className="flex-1 py-3.5 sm:py-5 rounded-xl sm:rounded-2xl shadow-2xl shadow-orange-600/20 text-base sm:text-lg uppercase font-black tracking-widest"
              onClick={() => handleSubmit(true)}
              isLoading={isSaving}
            >
              Zum Recruiter senden
            </Button>
          </div>

          {/* DSGVO: Account deletion */}
          <div className="mt-6 sm:mt-10">
            <div className="bg-white/95 rounded-2xl border border-red-100 p-4 sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900">Konto löschen</h4>
                  <p className="text-xs sm:text-sm text-slate-600 mt-1">
                    Du kannst dein Konto jederzeit dauerhaft löschen (DSGVO).
                  </p>
                </div>
                <Button
                  variant="danger"
                  className="h-10 px-4 rounded-xl text-xs sm:text-sm"
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
