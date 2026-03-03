
import React, { useState, useEffect } from 'react';
import { CandidateProfile, CandidateStatus, CandidateDocuments, SocialLink, validateProfileForPublishing, canPublishProfile } from '../types';
import { Button, Input, Select, Avatar, Badge, Textarea, FileUpload } from '../components/UI';
import { INDUSTRIES, AVAILABILITY_OPTIONS, SUGGESTED_KEYWORDS } from '../constants';
import { documentService } from '../services/DocumentService';
import { candidateService } from '../services/CandidateService';

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
    setDocuments(prev => ({ ...prev, qualifications: [...prev.qualifications, ...results] }));
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

  const handleSubmit = async (publish: boolean = false) => {
    // For publishing, validate all required fields
    if (publish) {
      const missing = validateProfileForPublishing(formData);
      if (missing.length > 0) {
        setMissingFields(missing);
        setShowPublishWarning(true);
        return;
      }
    }

    setIsSaving(true);
    try {
      const updatedProfile = {
        ...formData,
        isPublished: publish,
        status: publish ? CandidateStatus.ACTIVE : formData.status,
        updatedAt: new Date().toISOString()
      };

      // Save documents
      await candidateService.updateDocuments(documents);

      // Save profile
      onSave(updatedProfile);

      // If we are publishing, navigate to marketplace
      if (publish) {
        onNavigate('/talents');
      }
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
            <p className="text-slate-600 mb-4">Um dein Profil zu veröffentlichen, müssen folgende Felder ausgefüllt werden:</p>
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

      <header className="bg-white h-20 sticky top-0 z-30 shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-full flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src="/1adef99a-1986-43bc-acb8-278472ee426c.png" alt="CMS Talents" className="h-10 w-auto object-contain" />
            <div className="flex flex-col">
              <span className="font-black text-slate-900 leading-none text-sm tracking-tight uppercase">CMS Talents | Profil</span>
              <span className="text-[10px] text-orange-600 font-bold tracking-widest uppercase mt-1">Status: {formData.isPublished ? 'Live' : 'Entwurf'}</span>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={() => onNavigate('/talents')}
              className="text-xs font-black text-slate-600 hover:text-orange-600 transition-colors uppercase tracking-widest px-4"
            >
              Zum Marktplatz
            </button>
            <Button variant="ghost" size="sm" className="text-slate-600 hover:text-orange-600" onClick={onLogout}>Abmelden</Button>
            <Button size="sm" variant="primary" className="rounded-xl px-6" onClick={() => handleSubmit(formData.isPublished)} isLoading={isSaving}>Speichern</Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 mt-12">
        {/* Required fields notice */}
        <div className="bg-orange-500 border border-orange-300/40 rounded-2xl p-6 mb-8 flex items-start gap-4 shadow-[0_18px_60px_-45px_rgba(0,0,0,0.75)]">
          <div className="w-10 h-10 bg-white/15 border border-white/20 rounded-xl flex items-center justify-center text-white shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div>
            <h4 className="font-black text-white">Pflichtfelder</h4>
            <p className="text-sm text-white/90">
              Felder mit <span className="text-white font-black">*</span> sind erforderlich, um dein Profil zu veröffentlichen.
            </p>
          </div>
        </div>

        <div className="space-y-8">
          {/* Identity Section */}
          <section className="bg-white p-10 rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <div className="flex flex-col md:flex-row items-center gap-10">
              <div className="relative">
                <Avatar
                  seed={formData.firstName + formData.lastName || 'user'}
                  size="xl"
                  className="ring-[12px] ring-orange-50"
                  imageUrl={formData.profileImageUrl}
                />
                <label className="absolute -bottom-2 -right-2 p-3 bg-slate-900 text-orange-500 rounded-2xl shadow-xl cursor-pointer hover:bg-slate-800 transition-colors">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path></svg>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => handleProfileImageUpload(e.target.files)}
                    className="hidden"
                  />
                </label>
              </div>
              <div className="flex-1 w-full space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">Vorname<RequiredBadge /></label>
                    <Input name="firstName" value={formData.firstName} onChange={handleChange} placeholder="Max" error={errors.firstName} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">Nachname<RequiredBadge /></label>
                    <Input name="lastName" value={formData.lastName} onChange={handleChange} placeholder="Mustermann" error={errors.lastName} />
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">Stadt<RequiredBadge /></label>
                    <Input name="city" value={formData.city} onChange={handleChange} placeholder="Berlin" error={errors.city} />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-900 mb-1.5">Land<RequiredBadge /></label>
                    <Input name="country" value={formData.country} onChange={handleChange} placeholder="Deutschland" error={errors.country} />
                  </div>
                </div>

                {/* PRIVATE CONTACT INFO */}
                <div className="mt-6 pt-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="bg-slate-900 text-white text-[10px] uppercase font-black px-2 py-0.5 rounded">Privat & Admin Only</span>
                    <p className="text-xs text-slate-400">Diese Daten sind nur für die Plattform sichtbar.</p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-bold text-slate-900 mb-1.5">Straße & Hausnummer</label>
                      <Input name="address" value={formData.address || ''} onChange={handleChange} placeholder="Musterstraße 1" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1.5">PLZ</label>
                        <Input name="zipCode" value={formData.zipCode || ''} onChange={handleChange} placeholder="12345" />
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-900 mb-1.5">Telefon</label>
                        <Input name="phoneNumber" value={formData.phoneNumber || ''} onChange={handleChange} placeholder="+49 123..." />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-6">
                  <Input
                    label="Geburtsjahr"
                    name="birthYear"
                    type="number"
                    value={formData.birthYear || ''}
                    onChange={handleChange}
                    placeholder="1990"
                    min="1940"
                    max={new Date().getFullYear() - 16}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Details Section */}
          <section className="bg-white p-10 rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
              BERUFLICHER FOKUS
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 mb-8">
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Hauptbranche<RequiredBadge /></label>
                <Select name="industry" value={formData.industry} onChange={handleChange} error={errors.industry}>
                  <option value="">Branche wählen...</option>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </Select>
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Erfahrung (Jahre)<RequiredBadge /></label>
                <Input type="number" name="experienceYears" value={formData.experienceYears} onChange={handleNumberChange} min="0" max="50" />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-900 mb-1.5">Verfügbarkeit<RequiredBadge /></label>
                <Select name="availability" value={formData.availability} onChange={handleChange} error={errors.availability}>
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
            />
          </section>

          {/* Skills Section */}
          <section className="bg-white p-10 rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
              SKILLS & MATCHING-BOOST (optional)
            </h3>
            <div className="space-y-8">
              <div>
                <Input
                  label="Fachliche Skills"
                  placeholder="Skill eingeben & Enter drücken (z.B. React, SEO, SAP)"
                  value={newSkill}
                  onChange={(e) => setNewSkill(e.target.value)}
                  onKeyDown={handleAddSkill}
                />
                <div className="flex flex-wrap gap-2.5 mt-4">
                  {formData.skills.map(skill => (
                    <Badge key={skill} variant="orange" className="gap-2 px-4 py-2 text-sm shadow-sm border-orange-200">
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-red-600 font-bold transition-colors">×</button>
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="pt-6 border-t border-slate-50">
                <label className="text-xs font-black text-slate-400 block mb-4 uppercase tracking-[0.2em]">Sichtbarkeits-Boosters (Klick zum Aktivieren)</label>
                <div className="flex flex-wrap gap-3">
                  {SUGGESTED_KEYWORDS.map(kw => (
                    <button
                      key={kw}
                      type="button"
                      onClick={() => toggleKeyword(kw)}
                      className={`px-5 py-2.5 rounded-xl text-xs font-black transition-all border-2 ${formData.boostedKeywords.includes(kw) ? 'bg-slate-900 text-orange-500 border-slate-900 shadow-lg' : 'bg-slate-50 text-slate-500 border-transparent hover:border-slate-200'}`}
                    >
                      {kw.toUpperCase()}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Social Links Section */}
          <section className="bg-white p-10 rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
              SOCIAL LINKS (optional)
            </h3>

            {/* Existing links */}
            {formData.socialLinks.length > 0 && (
              <div className="space-y-3 mb-6">
                {formData.socialLinks.map((link, idx) => (
                  <div key={idx} className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl">
                    <span className="font-bold text-slate-700">{link.label}:</span>
                    <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-orange-600 hover:underline truncate flex-1">{link.url}</a>
                    <button type="button" onClick={() => removeLink(idx)} className="text-slate-400 hover:text-red-500">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add new link */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select value={newLink.label} onChange={(e) => setNewLink(prev => ({ ...prev, label: e.target.value }))}>
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
              />
              <Button type="button" variant="outline" onClick={handleAddLink} disabled={!newLink.label || !newLink.url}>
                Link hinzufügen
              </Button>
            </div>
          </section>

          {/* Documents Section */}
          <section className="bg-white p-10 rounded-3xl shadow-[0_22px_70px_-45px_rgba(2,6,23,0.45)] border border-slate-200/70">
            <h3 className="text-xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <span className="w-2 h-8 bg-orange-600 rounded-full"></span>
              DOKUMENTE (optional)
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FileUpload
                label="Lebenslauf (CV)"
                accept="application/pdf"
                onChange={handleCvUpload}
                files={documents.cvPdf ? [{ name: documents.cvPdf.name }] : []}
                onRemove={() => setDocuments(prev => ({ ...prev, cvPdf: undefined }))}
                helperText="PDF, max 10MB"
              />

              <FileUpload
                label="Zertifikate"
                accept="application/pdf"
                multiple
                onChange={handleCertificatesUpload}
                files={documents.certificates}
                onRemove={(idx) => setDocuments(prev => ({ ...prev, certificates: prev.certificates.filter((_, i) => i !== idx) }))}
                helperText="PDFs, max 10MB"
              />

              <FileUpload
                label="Qualifikationen"
                accept="application/pdf"
                multiple
                onChange={handleQualificationsUpload}
                files={documents.qualifications}
                onRemove={(idx) => setDocuments(prev => ({ ...prev, qualifications: prev.qualifications.filter((_, i) => i !== idx) }))}
                helperText="PDFs, max 10MB"
              />
            </div>
          </section>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 pt-10">
            <Button
              variant="outline"
              size="lg"
              className="flex-1 py-5 rounded-2xl border-2 border-slate-200"
              onClick={() => handleSubmit(false)}
              isLoading={isSaving}
            >
              Entwurf speichern
            </Button>
            <Button
              size="lg"
              variant="primary"
              className="flex-1 py-5 rounded-2xl shadow-2xl shadow-orange-600/20 text-lg uppercase font-black tracking-widest"
              onClick={() => handleSubmit(true)}
              isLoading={isSaving}
            >
              Profil veröffentlichen
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default CandidateProfilePage;
