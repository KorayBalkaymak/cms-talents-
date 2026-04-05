
import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { CandidateProfile, CandidateDocuments, UserRole } from '../types';
import { rankCandidates, highlightText } from '../services/SearchService';
import { candidateService } from '../services/CandidateService';
import { authService } from '../services/AuthService';
import { CmsLogoHeroBadge } from '../components/CmsLogoHeroBadge';
import { Input, Avatar, Badge, Button, Modal, EmptyState } from '../components/UI';
import { INDUSTRIES, AVAILABILITY_OPTIONS } from '../constants';
import { User } from '../types';

interface TalentMarketplaceProps {
  candidates: CandidateProfile[];
  selectedId?: string;
  onNavigate: (path: string) => void;
  user?: User | null;
}

type MatchItem = { candidate: CandidateProfile; score: number };

function codeNameFromUserId(userId: string): string {
  const labels = ['TX', 'QN', 'VK', 'RM', 'SL', 'PN', 'ZR', 'LF', 'MK', 'JD'];
  let hash = 0;
  for (let i = 0; i < userId.length; i += 1) {
    hash = (hash * 31 + userId.charCodeAt(i)) >>> 0;
  }
  const label = labels[hash % labels.length];
  const suffix = String(hash % 1000).padStart(3, '0');
  return `${label}${suffix}`;
}

function anonymizeCandidateText(text: string, candidate: CandidateProfile, codeName: string): string {
  const input = (text || '').trim();
  if (!input) return '';
  const first = (candidate.firstName || '').trim();
  const last = (candidate.lastName || '').trim();
  let output = input;
  if (first && last) {
    const full = new RegExp(`${first}\\s+${last}`, 'gi');
    output = output.replace(full, codeName);
  }
  if (first) output = output.replace(new RegExp(first, 'gi'), codeName);
  if (last) output = output.replace(new RegExp(last, 'gi'), codeName);
  return output;
}

const CandidateCard = memo(({ item, search, onSelect, codeName }: { item: MatchItem; search: string; onSelect: (c: CandidateProfile) => void; codeName: string }) => {
  const { candidate, score } = item;
  const skills = candidate.skills ?? [];
  const profession = useMemo(() => {
    const raw = (candidate.profession || '').trim();
    if (raw) return raw;
    const about = candidate.about || '';
    const legacyLine = about.split('\n').find((line) => line.trim().startsWith('[profession]:'));
    if (legacyLine) {
      const encoded = legacyLine.trim().slice('[profession]:'.length);
      try {
        const decoded = decodeURIComponent(encoded || '').trim();
        if (decoded) return decoded;
      } catch {
        // ignore invalid legacy encoding
      }
    }
    return (candidate.industry || '').trim();
  }, [candidate.profession, candidate.about, candidate.industry]);
  const workRadiusKm = useMemo(() => {
    if (candidate.workRadiusKm !== null && candidate.workRadiusKm !== undefined) return candidate.workRadiusKm;
    const about = candidate.about || '';
    const legacyLine = about.split('\n').find((line) => line.trim().startsWith('[radius]:'));
    if (legacyLine) {
      const raw = legacyLine.trim().slice('[radius]:'.length);
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }
    return null;
  }, [candidate.workRadiusKm, candidate.about]);
  const salaryWishEur = useMemo(() => {
    if (candidate.salaryWishEur !== null && candidate.salaryWishEur !== undefined) return candidate.salaryWishEur;
    const about = candidate.about || '';
    const legacyLine = about
      .split('\n')
      .find((line) => {
        const t = line.trim().toLowerCase();
        return t.startsWith('[salary]:') || t.startsWith('[salary_eur]:');
      });
    if (legacyLine) {
      const raw = legacyLine.split(':').slice(1).join(':').trim();
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }
    return null;
  }, [candidate.salaryWishEur, candidate.about]);
  const handleClick = useCallback(() => { onSelect(candidate); }, [candidate, onSelect]);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="group bg-white p-6 rounded-2xl border border-slate-200 hover:border-slate-300 hover:shadow-[0_18px_50px_-30px_rgba(2,6,23,0.35)] transition-all cursor-pointer flex flex-col"
      style={{ contentVisibility: 'auto', contain: 'layout paint' }}
    >
      <div className="flex items-start gap-4 mb-5">
        <Avatar seed={codeName} size="md" imageUrl={candidate.profileImageUrl} className="shrink-0 ring-4 ring-orange-50" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-black text-[#101B31] tracking-tight leading-tight group-hover:text-slate-900 transition-colors">
            {highlightText(codeName, search)}
          </h3>
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 text-orange-600 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"></path></svg>
            {highlightText(candidate.city, search)}
          </div>
        </div>
        {score > 0 && (
          <Badge variant="orange" className="h-7 shrink-0 px-3 bg-orange-50 text-orange-700 border border-orange-100">
            Match {Math.min(100, score * 10)}%
          </Badge>
        )}
      </div>
      <div className="space-y-4 mb-6 flex-1">
        <div className="flex flex-wrap gap-2">
          {profession && (
            <Badge variant="slate" className="bg-slate-50 text-[#101B31] border border-slate-200 px-3 py-1">
              {profession}
            </Badge>
          )}
          {candidate.industry && <Badge variant="slate" className="bg-slate-50 text-[#101B31] border border-slate-200 px-3 py-1">{candidate.industry}</Badge>}
          <Badge variant="slate" className="bg-slate-50 text-[#101B31] border border-slate-200 px-3 py-1">{candidate.experienceYears} J. Exp</Badge>
          {workRadiusKm !== null && workRadiusKm !== undefined && (
            <Badge variant="slate" className="bg-slate-50 text-[#101B31] border border-slate-200 px-3 py-1">
              {workRadiusKm} km Radius
            </Badge>
          )}
          {salaryWishEur !== null && salaryWishEur !== undefined && (
            <Badge variant="slate" className="bg-slate-50 text-[#101B31] border border-slate-200 px-3 py-1">
              {salaryWishEur} EUR Wunschgehalt
            </Badge>
          )}
          {candidate.availability && <Badge variant="green" className="px-3 py-1">{candidate.availability}</Badge>}
        </div>
        {candidate.about && (
          <p className="text-slate-600 text-sm font-medium line-clamp-2 leading-relaxed">
            "{highlightText(anonymizeCandidateText(candidate.about, candidate, codeName), search)}"
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
        <div className="flex flex-wrap gap-1.5">
          {skills.slice(0, 4).map(skill => (
            <span key={skill} className="text-xs font-medium text-slate-500">
              #{highlightText(skill, search)}
            </span>
          ))}
          {skills.length > 4 && <span className="text-xs font-medium text-orange-600">+{skills.length - 4}</span>}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleClick();
          }}
          className="shrink-0 rounded-xl bg-[#101B31] px-3 py-2 text-[11px] font-black uppercase tracking-wide text-white hover:bg-slate-800"
        >
          Ich habe Interesse
        </button>
      </div>
    </div>
  );
});
CandidateCard.displayName = 'CandidateCard';

const TalentMarketplace: React.FC<TalentMarketplaceProps> = (props) => {
  const { candidates, selectedId, onNavigate } = props;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [filterExp, setFilterExp] = useState(0);
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'experience'>('relevance');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [selectedCandidateDocs, setSelectedCandidateDocs] = useState<CandidateDocuments | null>(null);
  const [loadingSelectedDocs, setLoadingSelectedDocs] = useState(false);
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState<string>('');
  const [inquiryForm, setInquiryForm] = useState({
    companyName: '',
    firstName: '',
    lastName: '',
    customerPosition: '',
    contactEmail: '',
    contactPhone: '',
    projectDuration: '',
    projectLocation: '',
    budget: '',
  });
  const [inquiryLoading, setInquiryLoading] = useState(false);
  const [inquiryError, setInquiryError] = useState('');
  const [inquirySuccess, setInquirySuccess] = useState('');
  const [showInquiryForm, setShowInquiryForm] = useState(false);

  // PDF in Modal mit iframe anzeigen (zuverlässig, keine weiße Seite)
  const openDocument = async (userId: string, docType: string, docName: string) => {
    setDocumentLoading(docName);
    try {
      const docs = await candidateService.getMarketplaceDocuments(userId);
      if (!docs) return;
      let data: string | undefined;
      if (docType === 'cv' && docs.cvPdf?.data) data = docs.cvPdf.data;
      else if (docType === 'certificate') data = docs.certificates?.find(c => c.name === docName)?.data;
      else if (docType === 'qualification') data = docs.qualifications?.find(q => q.name === docName)?.data;
      if (!data) return;
      const base64 = data.includes('base64,') ? data.split('base64,')[1] : data;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfViewerTitle(docName);
      setPdfViewerUrl(url);
    } catch (e) {
      console.error('Dokument konnte nicht geladen werden:', e);
    } finally {
      setDocumentLoading(null);
    }
  };

  const closePdfViewer = useCallback(() => {
    setPdfViewerUrl((url) => {
      if (url) URL.revokeObjectURL(url);
      return null;
    });
    setPdfViewerTitle('');
  }, []);

  const handleSelectCandidate = useCallback((candidate: CandidateProfile) => {
    setShowInquiryForm(false);
    setSelectedCandidate(candidate);
    setInquiryError('');
    setInquirySuccess('');
    onNavigate('/talents');
  }, [onNavigate]);

  const selectedCandidateCodeName = useMemo(
    () => (selectedCandidate ? codeNameFromUserId(selectedCandidate.userId) : ''),
    [selectedCandidate]
  );
  const selectedDocsList = useMemo(() => {
    if (!selectedCandidateDocs) return [];
    const items: { type: string; name: string }[] = [];
    if (selectedCandidateDocs.cvPdf?.name) items.push({ type: 'cv', name: selectedCandidateDocs.cvPdf.name });
    for (const doc of selectedCandidateDocs.certificates || []) if (doc?.name) items.push({ type: 'certificate', name: doc.name });
    for (const doc of selectedCandidateDocs.qualifications || []) if (doc?.name) items.push({ type: 'qualification', name: doc.name });
    return items;
  }, [selectedCandidateDocs]);

  const submitInquiry = async () => {
    if (!selectedCandidate) return;
    setInquiryError('');
    setInquirySuccess('');
    const missingRequired =
      !inquiryForm.companyName.trim() ||
      !inquiryForm.firstName.trim() ||
      !inquiryForm.lastName.trim() ||
      !inquiryForm.customerPosition.trim() ||
      !inquiryForm.contactEmail.trim() ||
      !inquiryForm.contactPhone.trim() ||
      !inquiryForm.projectDuration.trim() ||
      !inquiryForm.projectLocation.trim() ||
      !inquiryForm.budget.trim();
    if (missingRequired) {
      setInquiryError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    const email = inquiryForm.contactEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setInquiryError('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    setInquiryLoading(true);
    try {
      const fullName = `${inquiryForm.firstName.trim()} ${inquiryForm.lastName.trim()}`.trim();
      const structuredMessage = [
        `Firma: ${inquiryForm.companyName.trim()}`,
        `Position (Kunde): ${inquiryForm.customerPosition.trim()}`,
        `Projektlaufzeit: ${inquiryForm.projectDuration.trim()}`,
        `Projektstandort: ${inquiryForm.projectLocation.trim()}`,
        `Budget (EUR): ${inquiryForm.budget.trim()} EUR`,
      ].join('\n');
      await candidateService.createInquiry({
        candidateUserId: selectedCandidate.userId,
        contactName: fullName,
        contactEmail: email,
        contactPhone: inquiryForm.contactPhone.trim(),
        message: structuredMessage,
      });
      setInquirySuccess('Vielen Dank. Ihre Anfrage wurde an das Recruiter-Team gesendet.');
      setInquiryForm({
        companyName: '',
        firstName: '',
        lastName: '',
        customerPosition: '',
        contactEmail: '',
        contactPhone: '',
        projectDuration: '',
        projectLocation: '',
        budget: '',
      });
    } catch (e: any) {
      setInquiryError(e?.message || 'Anfrage konnte nicht gesendet werden.');
    } finally {
      setInquiryLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open selected candidate modal
  useEffect(() => {
    if (selectedId) {
      const found = candidates.find(c => c.userId === selectedId);
      if (found && selectedCandidate?.userId !== found.userId) setSelectedCandidate(found);
    }
  }, [selectedId, candidates, selectedCandidate?.userId]);

  useEffect(() => {
    if (!selectedCandidate) {
      setSelectedCandidateDocs(null);
      setLoadingSelectedDocs(false);
      return;
    }
    let cancelled = false;
    setLoadingSelectedDocs(true);
    (async () => {
      try {
        const docs = await candidateService.getMarketplaceDocuments(selectedCandidate.userId);
        if (!cancelled) setSelectedCandidateDocs(docs || null);
      } finally {
        if (!cancelled) setLoadingSelectedDocs(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCandidate?.userId]);

  const filteredAndRanked = useMemo(() => {
    let list = rankCandidates(candidates, debouncedSearch);

    if (filterIndustry) {
      list = list.filter(m => m.candidate.industry === filterIndustry);
    }
    if (filterAvailability) {
      list = list.filter(m => m.candidate.availability === filterAvailability);
    }
    if (filterExp > 0) {
      list = list.filter(m => m.candidate.experienceYears >= filterExp);
    }

    if (sortBy === 'newest') {
      list.sort((a, b) => new Date(b.candidate.createdAt).getTime() - new Date(a.candidate.createdAt).getTime());
    } else if (sortBy === 'experience') {
      list.sort((a, b) => b.candidate.experienceYears - a.candidate.experienceYears);
    } else {
      list.sort((a, b) => b.score - a.score);
    }

    return list;
  }, [candidates, debouncedSearch, filterIndustry, filterAvailability, filterExp, sortBy]);

  const resultCards = useMemo(
    () =>
      filteredAndRanked.map((item) => (
        <CandidateCard
          key={item.candidate.userId}
          item={item}
          search={debouncedSearch}
          onSelect={handleSelectCandidate}
          codeName={codeNameFromUserId(item.candidate.userId)}
        />
      )),
    [filteredAndRanked, debouncedSearch, handleSelectCandidate]
  );

  const handleLogout = () => {
    authService.logout();
    window.location.hash = '/';
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation Bar */}
      <header className="bg-[#101B31] border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex items-center justify-between gap-4">
            <div
              className="flex min-w-0 cursor-pointer items-center gap-3 shrink-0"
              onClick={() => onNavigate('/')}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onNavigate('/');
                }
              }}
            >
              <div className="shrink-0 origin-left scale-[0.32] sm:scale-[0.38] md:scale-[0.44] lg:scale-[0.50] xl:scale-[0.56]">
                <CmsLogoHeroBadge className="!justify-start" />
              </div>
            </div>

            <div className="hidden lg:block flex-1 max-w-xl">
              <div className="relative group">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-orange-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input
                  type="text"
                  placeholder="Suche nach Skills, Ort, Branche…"
                  className="w-full pl-11 pr-4 h-11 bg-white border border-slate-200 text-slate-900 text-sm rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400 shadow-sm"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {props.user ? (
                <>
                  <span className="text-sm text-slate-300 hidden md:block mr-1">Hallo, {props.user.firstName || 'User'}</span>
                  {(props.user.role === UserRole.ADMIN || props.user.role === UserRole.RECRUITER) ? (
                    <Button size="sm" variant="primary" onClick={() => onNavigate('/recruiter/dashboard')} className="h-10 text-sm px-4 rounded-xl focus:ring-offset-[#101B31]">
                      Dashboard
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => onNavigate('/candidate/profile')}
                      className="h-10 text-sm px-4 rounded-xl focus:ring-offset-[#101B31]"
                    >
                      Mein Profil
                    </Button>
                  )}
                  <button type="button" onClick={handleLogout} className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 text-slate-200 hover:text-white hover:bg-white/20 transition-colors" title="Abmelden">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                  </button>
                </>
              ) : (
                <>
                  <Button size="sm" onClick={() => onNavigate('/candidate/auth')} className="h-10 text-sm px-4 rounded-xl focus:ring-offset-[#101B31]">
                    Anmelden
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Mobile search */}
          <div className="lg:hidden mt-3">
            <div className="relative group">
              <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-orange-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                placeholder="Suche nach Skills, Ort, Branche…"
                className="w-full pl-11 pr-4 h-11 bg-white border border-slate-200 text-slate-900 text-sm rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400 shadow-sm"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row gap-10" style={{ contain: 'paint' }}>
        {/* Filters */}
        <aside className="lg:w-80 flex-shrink-0 space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-[0_18px_60px_-45px_rgba(2,6,23,0.25)] overflow-hidden">
            <div className="px-6 py-5 bg-[#101B31] text-white flex items-center justify-between">
              <div>
                <div className="text-xs font-black tracking-[0.25em] text-white/70 uppercase">Filter</div>
                <div className="text-lg font-black tracking-tight">Suchkriterien</div>
              </div>
              <button
                type="button"
                className="h-9 shrink-0 rounded-xl bg-white px-4 text-xs font-black uppercase tracking-wide text-[#101B31] shadow-md transition-colors hover:bg-orange-50 hover:text-[#101B31] focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-[#101B31]"
                onClick={() => {
                  setSearch('');
                  setFilterIndustry('');
                  setFilterExp(0);
                  setFilterAvailability('');
                }}
              >
                Zurücksetzen
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-sm font-black text-[#101B31] mb-3">Branche</h4>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                    <input type="radio" name="industry" checked={filterIndustry === ''} onChange={() => setFilterIndustry('')} className="w-4 h-4 accent-orange-600 border-slate-300 focus:ring-2 focus:ring-orange-500/30" />
                    <span className="group-hover:text-[#101B31]">Alle Branchen</span>
                  </label>
                  {INDUSTRIES.map(ind => (
                    <label key={ind} className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                      <input type="radio" name="industry" checked={filterIndustry === ind} onChange={() => setFilterIndustry(ind)} className="w-4 h-4 accent-orange-600 border-slate-300 focus:ring-2 focus:ring-orange-500/30" />
                      <span className="group-hover:text-[#101B31]">{ind}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <h4 className="text-sm font-black text-[#101B31] mb-3">Verfügbarkeit</h4>
                <div className="space-y-2.5">
                  <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                    <input type="radio" name="availability" checked={filterAvailability === ''} onChange={() => setFilterAvailability('')} className="w-4 h-4 accent-orange-600 border-slate-300 focus:ring-2 focus:ring-orange-500/30" />
                    <span className="group-hover:text-[#101B31]">Alle</span>
                  </label>
                  {AVAILABILITY_OPTIONS.map(opt => (
                    <label key={opt} className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                      <input type="radio" name="availability" checked={filterAvailability === opt} onChange={() => setFilterAvailability(opt)} className="w-4 h-4 accent-orange-600 border-slate-300 focus:ring-2 focus:ring-orange-500/30" />
                      <span className="group-hover:text-[#101B31]">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="h-px bg-slate-100" />

              <div>
                <h4 className="text-sm font-black text-[#101B31] mb-3">Erfahrung</h4>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest">{filterExp}+ Jahre</span>
                  <span className="text-[11px] font-black text-orange-600 uppercase tracking-widest">Minimum</span>
                </div>
                <input
                  type="range" min="0" max="20"
                  className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-600 mt-3"
                  value={filterExp}
                  onChange={(e) => setFilterExp(parseInt(e.target.value))}
                />
                <div className="flex justify-between text-[10px] font-black text-slate-400 mt-2 uppercase tracking-tighter">
                  <span>Junior</span>
                  <span>Senior</span>
                  <span>Expert</span>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
            <div>
              <div className="text-xs font-black tracking-[0.25em] text-slate-400 uppercase">Talent Marketplace</div>
              <h2 className="text-3xl md:text-4xl font-black text-[#101B31] tracking-tighter leading-tight">
                {filteredAndRanked.length} Talente
              </h2>
              {debouncedSearch && <p className="text-slate-500 font-bold mt-2 uppercase text-[11px] tracking-widest">Suche für: "{debouncedSearch}"</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sortierung</span>
              <select
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs font-black text-orange-600 outline-none cursor-pointer uppercase tracking-widest shadow-sm"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="relevance">Relevanz</option>
                <option value="newest">Neueste</option>
                <option value="experience">Erfahrung</option>
              </select>
            </div>
          </div>

          {filteredAndRanked.length === 0 ? (
            <EmptyState
              title="Keine Talente gefunden"
              description={debouncedSearch || filterIndustry || filterExp > 0 || filterAvailability
                ? "Versuche andere Suchbegriffe oder Filter."
                : "Es sind noch keine Kandidaten registriert."}
              icon={
                <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeWidth="1.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
              }
              action={
                <Button onClick={() => { setSearch(''); setFilterIndustry(''); setFilterExp(0); setFilterAvailability(''); }}>Filter zurücksetzen</Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6" style={{ contain: 'layout' }}>
              {resultCards}
            </div>
          )}
        </div>
      </main>

      {selectedCandidate && (
        <Modal
          isOpen={!!selectedCandidate}
          onClose={() => {
            setSelectedCandidate(null);
            setShowInquiryForm(false);
            setInquiryError('');
            setInquirySuccess('');
            onNavigate('/talents');
          }}
          title={selectedCandidateCodeName ? `Kandidatenprofil · ${selectedCandidateCodeName}` : 'Kandidatenprofil'}
        >
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs font-black text-slate-400 uppercase">Erfahrung</p><p className="text-lg font-bold text-slate-900">{selectedCandidate.experienceYears} Jahre</p></div>
              <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs font-black text-slate-400 uppercase">Verfügbarkeit</p><p className="text-lg font-bold text-slate-900">{selectedCandidate.availability || '-'}</p></div>
              {selectedCandidate.birthYear && <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs font-black text-slate-400 uppercase">Geburtsjahr</p><p className="text-lg font-bold text-slate-900">{selectedCandidate.birthYear}</p></div>}
            </div>

            {(selectedCandidate.address || selectedCandidate.zipCode || selectedCandidate.phoneNumber) && (
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">Kontakt / Adresse</p>
                <div className="space-y-1 text-slate-700">
                  {selectedCandidate.address && <p>{selectedCandidate.address}</p>}
                  {(selectedCandidate.zipCode || selectedCandidate.city) && <p>{[selectedCandidate.zipCode, selectedCandidate.city].filter(Boolean).join(' ')}</p>}
                  {selectedCandidate.phoneNumber && <p><a href={`tel:${selectedCandidate.phoneNumber}`} className="text-orange-600 hover:underline">{selectedCandidate.phoneNumber}</a></p>}
                </div>
              </div>
            )}

            {selectedCandidate.about && <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs font-black text-slate-400 uppercase mb-2">Über</p><p className="break-words [overflow-wrap:anywhere] text-slate-700">{anonymizeCandidateText(selectedCandidate.about, selectedCandidate, selectedCandidateCodeName)}</p></div>}
            {(selectedCandidate.skills?.length ?? 0) > 0 && <div><p className="text-xs font-black text-slate-400 uppercase mb-3">Skills</p><div className="flex flex-wrap gap-2">{selectedCandidate.skills.map(skill => <Badge key={skill} variant="orange">{highlightText(skill, debouncedSearch)}</Badge>)}</div></div>}
            {(selectedCandidate.boostedKeywords?.length ?? 0) > 0 && <div><p className="text-xs font-black text-slate-400 uppercase mb-3">Spezialisierungen</p><div className="flex flex-wrap gap-2">{selectedCandidate.boostedKeywords.map(kw => <Badge key={kw} variant="dark">{kw}</Badge>)}</div></div>}

            {loadingSelectedDocs ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600">
                Dokumente werden geladen...
              </div>
            ) : selectedDocsList.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Dokumente (anklicken zum Ansehen)</p>
                <div className="space-y-2">
                  {selectedDocsList.map((doc, idx) => (
                    <button key={idx} type="button" onClick={() => openDocument(selectedCandidate.userId, doc.type, doc.name)} disabled={!!documentLoading} className="flex items-center gap-2 w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-100 hover:border-orange-200 transition-colors group">
                      <span className="w-10 h-10 rounded-lg bg-slate-200 group-hover:bg-orange-100 flex items-center justify-center shrink-0"><svg className="w-5 h-5 text-slate-600 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg></span>
                      <div className="flex-1 min-w-0"><span className="text-slate-500 text-xs uppercase block">{doc.type === 'cv' ? 'Lebenslauf (CV)' : doc.type === 'certificate' ? 'Zertifikat' : 'Qualifikation'}</span><span className="font-bold text-slate-900 truncate block">{doc.name}</span></div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
              <Button className="w-full sm:w-auto" variant="primary" onClick={() => setShowInquiryForm((v) => !v)}>
                Ich habe Interesse
              </Button>
              {showInquiryForm && (
                <>
                  <p className="mt-4 mb-3 text-sm font-medium text-slate-700">Bitte alle Pflichtfelder ausfüllen.</p>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <Input value={inquiryForm.companyName} onChange={(e) => setInquiryForm((s) => ({ ...s, companyName: e.target.value }))} placeholder="Welche Firma *" className="h-10" />
                    <Input value={inquiryForm.firstName} onChange={(e) => setInquiryForm((s) => ({ ...s, firstName: e.target.value }))} placeholder="Vorname *" className="h-10" />
                    <Input value={inquiryForm.lastName} onChange={(e) => setInquiryForm((s) => ({ ...s, lastName: e.target.value }))} placeholder="Nachname *" className="h-10" />
                    <Input value={inquiryForm.customerPosition} onChange={(e) => setInquiryForm((s) => ({ ...s, customerPosition: e.target.value }))} placeholder="Welche Position haben Sie? *" className="h-10" />
                    <Input type="email" value={inquiryForm.contactEmail} onChange={(e) => setInquiryForm((s) => ({ ...s, contactEmail: e.target.value }))} placeholder="E-Mail *" className="h-10" />
                    <Input value={inquiryForm.contactPhone} onChange={(e) => setInquiryForm((s) => ({ ...s, contactPhone: e.target.value }))} placeholder="Telefonnummer *" className="h-10" />
                    <Input value={inquiryForm.projectDuration} onChange={(e) => setInquiryForm((s) => ({ ...s, projectDuration: e.target.value }))} placeholder="Projektlaufzeit *" className="h-10" />
                    <Input value={inquiryForm.projectLocation} onChange={(e) => setInquiryForm((s) => ({ ...s, projectLocation: e.target.value }))} placeholder="Projektstandort *" className="h-10" />
                    <Input type="number" min="0" value={inquiryForm.budget} onChange={(e) => setInquiryForm((s) => ({ ...s, budget: e.target.value }))} placeholder="Budget (EUR) *" className="h-10" />
                  </div>
                  {inquiryError && <p className="mt-2 text-xs font-bold text-red-600">{inquiryError}</p>}
                  {inquirySuccess && <p className="mt-2 text-xs font-bold text-emerald-700">{inquirySuccess}</p>}
                  <Button className="mt-3 w-full sm:w-auto" variant="primary" isLoading={inquiryLoading} onClick={submitInquiry}>
                    Zum Recruiter absenden
                  </Button>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* PDF-Viewer: Dokument im gleichen Fenster anzeigen (keine weiße Seite) */}
      {pdfViewerUrl && (
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900">
          <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-b border-slate-700 shrink-0">
            <span className="text-white font-bold truncate pr-4">{pdfViewerTitle}</span>
            <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 shrink-0" onClick={closePdfViewer}>
              Schließen
            </Button>
          </div>
          <iframe
            src={pdfViewerUrl}
            title={pdfViewerTitle}
            className="flex-1 w-full min-h-0 border-0"
          />
        </div>
      )}
    </div>
  );
};

export default TalentMarketplace;
