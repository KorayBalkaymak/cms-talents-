
import React, { useState, useMemo, useEffect, useCallback, useRef, memo } from 'react';
import { CandidateProfile, CandidateDocuments, UserRole } from '../types';
import { rankCandidates, highlightText } from '../services/SearchService';
import { candidateService } from '../services/CandidateService';
import { authService } from '../services/AuthService';
import { CmsLogoHeroBadge } from '../components/CmsLogoHeroBadge';
import { Input, Textarea, Avatar, Badge, Button, Modal, EmptyState, FileUpload } from '../components/UI';
import { documentService } from '../services/DocumentService';
import { INDUSTRIES, AVAILABILITY_OPTIONS } from '../constants';
import { User } from '../types';

interface TalentMarketplaceProps {
  candidates: CandidateProfile[];
  isLoading?: boolean;
  selectedId?: string;
  onNavigate: (path: string) => void;
  user?: User | null;
}

type MatchItem = { candidate: CandidateProfile; score: number };

/**
 * Marktplatz-Dokumentzeile: Zuordnung per Slot + Index (nicht nur Dateiname),
 * damit gleiche Namen in CV / Zertifikat / Qualifikation nicht denselben Inhalt öffnen.
 */
type MarketplaceDocEntry = {
  slot: 'cv' | 'certificate' | 'qualification';
  /** Position in certificates[] bzw. qualifications[]; bei CV immer 0. */
  index: number;
  displayName: string;
};

/** Max. PDF-Unterlagen pro Interessenanfrage (Marktplatz). */
const MAX_INQUIRY_CUSTOMER_PDFS = 2;
const CALENDAR_WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function formatDateDe(date: Date): string {
  return date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function calendarMonthLabel(date: Date): string {
  return date.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
}

function buildCalendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const mondayOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - mondayOffset);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(start);
    day.setDate(start.getDate() + index);
    return day;
  });
}

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
          {candidate.workArea?.trim() ? (
            <Badge variant="slate" className="bg-slate-50 text-[#101B31] border border-slate-200 px-3 py-1">
              {candidate.workArea.trim()}
            </Badge>
          ) : workRadiusKm !== null && workRadiusKm !== undefined ? (
            <Badge variant="slate" className="bg-slate-50 text-[#101B31] border border-slate-200 px-3 py-1">
              {workRadiusKm} km Radius
            </Badge>
          ) : null}
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
  const { candidates, isLoading = false, selectedId, onNavigate } = props;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [filterExp, setFilterExp] = useState(0);
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'experience'>('relevance');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [selectedCandidateDocs, setSelectedCandidateDocs] = useState<CandidateDocuments | null>(null);
  const [loadingSelectedDocs, setLoadingSelectedDocs] = useState(false);
  const [documentLoading, setDocumentLoading] = useState<string | null>(null); // z. B. "cv:0", "qualification:1"
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
  const [inquiryCustomerPdfs, setInquiryCustomerPdfs] = useState<{ name: string; data: string }[]>([]);
  const [inquiryPdfError, setInquiryPdfError] = useState('');
  const [showGeneralInquiryModal, setShowGeneralInquiryModal] = useState(false);
  const [generalInquiryForm, setGeneralInquiryForm] = useState({
    companyName: '',
    customerPosition: '',
    projectStart: '',
    projectDuration: '',
    projectLocation: '',
    budget: '',
    firstName: '',
    lastName: '',
    contactEmail: '',
    contactPhone: '',
    searchProfile: '',
  });
  const [generalInquiryLoading, setGeneralInquiryLoading] = useState(false);
  const [generalInquiryError, setGeneralInquiryError] = useState('');
  const [generalInquirySuccess, setGeneralInquirySuccess] = useState('');
  const [generalInquiryCustomerPdfs, setGeneralInquiryCustomerPdfs] = useState<{ name: string; data: string }[]>([]);
  const [generalInquiryPdfError, setGeneralInquiryPdfError] = useState('');
  const [showGeneralProjectStartCalendar, setShowGeneralProjectStartCalendar] = useState(false);
  const [generalProjectStartMonth, setGeneralProjectStartMonth] = useState(() => new Date());
  const candidateModalBodyRef = useRef<HTMLDivElement>(null);

  // PDF in Modal mit iframe anzeigen (zuverlässig, keine weiße Seite)
  const openDocument = async (
    userId: string,
    slot: MarketplaceDocEntry['slot'],
    index: number,
    displayName: string
  ) => {
    const loadKey = `${slot}:${index}`;
    setDocumentLoading(loadKey);
    try {
      const docs = await candidateService.getMarketplaceDocuments(userId);
      if (!docs) return;
      let data: string | undefined;
      if (slot === 'cv') {
        data = docs.cvPdf?.data;
      } else if (slot === 'certificate') {
        data = docs.certificates?.[index]?.data;
      } else {
        data = docs.qualifications?.[index]?.data;
      }
      if (!data) return;
      const base64 = data.includes('base64,') ? data.split('base64,')[1] : data;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      setPdfViewerTitle(displayName);
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
    setInquiryCustomerPdfs([]);
    setInquiryPdfError('');
    setSelectedCandidate(candidate);
    setInquiryError('');
    setInquirySuccess('');
    onNavigate('/talents');
  }, [onNavigate]);

  const handleInquiryCustomerPdfs = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_INQUIRY_CUSTOMER_PDFS - inquiryCustomerPdfs.length;
    if (remaining <= 0) return;
    setInquiryPdfError('');
    const toAdd = Math.min(files.length, remaining);
    const next = [...inquiryCustomerPdfs];
    for (let i = 0; i < toAdd; i += 1) {
      const result = await documentService.uploadPdf(files[i]);
      if (!result.success) {
        setInquiryPdfError(result.error || 'PDF konnte nicht verarbeitet werden.');
        break;
      }
      if (result.data && result.name) next.push({ name: result.name, data: result.data });
    }
    setInquiryCustomerPdfs(next);
  };

  const handleGeneralInquiryCustomerPdfs = async (files: FileList | null) => {
    if (!files?.length) return;
    const remaining = MAX_INQUIRY_CUSTOMER_PDFS - generalInquiryCustomerPdfs.length;
    if (remaining <= 0) return;
    setGeneralInquiryPdfError('');
    const toAdd = Math.min(files.length, remaining);
    const next = [...generalInquiryCustomerPdfs];
    for (let i = 0; i < toAdd; i += 1) {
      const result = await documentService.uploadPdf(files[i]);
      if (!result.success) {
        setGeneralInquiryPdfError(result.error || 'PDF konnte nicht verarbeitet werden.');
        break;
      }
      if (result.data && result.name) next.push({ name: result.name, data: result.data });
    }
    setGeneralInquiryCustomerPdfs(next);
  };

  const selectedCandidateCodeName = useMemo(
    () => (selectedCandidate ? codeNameFromUserId(selectedCandidate.userId) : ''),
    [selectedCandidate]
  );
  const generalProjectStartDays = useMemo(
    () => buildCalendarDays(generalProjectStartMonth),
    [generalProjectStartMonth]
  );
  const selectedDocsList = useMemo((): MarketplaceDocEntry[] => {
    if (!selectedCandidateDocs) return [];
    const items: MarketplaceDocEntry[] = [];
    const cv = selectedCandidateDocs.cvPdf;
    if (cv?.data?.trim()) {
      items.push({
        slot: 'cv',
        index: 0,
        displayName: cv.name?.trim() || 'Lebenslauf.pdf',
      });
    }
    (selectedCandidateDocs.certificates || []).forEach((doc, i) => {
      if (doc?.data?.trim()) {
        items.push({
          slot: 'certificate',
          index: i,
          displayName: doc.name?.trim() || `Zertifikat-${i + 1}.pdf`,
        });
      }
    });
    (selectedCandidateDocs.qualifications || []).forEach((doc, i) => {
      if (doc?.data?.trim()) {
        items.push({
          slot: 'qualification',
          index: i,
          displayName: doc.name?.trim() || `Qualifikation-${i + 1}.pdf`,
        });
      }
    });
    return items;
  }, [selectedCandidateDocs]);

  const renderMarketplaceDocButtons = () =>
    selectedDocsList.map((doc, idx) => (
        <button
          key={`${doc.slot}-${doc.index}-${idx}`}
          type="button"
          onClick={() =>
            selectedCandidate &&
            openDocument(selectedCandidate.userId, doc.slot, doc.index, doc.displayName)
          }
          disabled={!!documentLoading}
          className="flex items-center gap-2 w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-100 hover:border-orange-200 transition-colors group"
        >
          <span className="w-10 h-10 rounded-lg bg-slate-200 group-hover:bg-orange-100 flex items-center justify-center shrink-0">
            <svg className="w-5 h-5 text-slate-600 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
          </span>
          <div className="flex-1 min-w-0">
            <span className="text-slate-500 text-xs uppercase block">
              {doc.slot === 'cv'
                ? 'Lebenslauf (CV)'
                : doc.slot === 'certificate'
                  ? 'Zertifikat'
                  : 'Qualifikation'}
            </span>
            <span className="font-bold text-slate-900 truncate block">{doc.displayName}</span>
          </div>
        </button>
    ));

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
        customerAttachments: inquiryCustomerPdfs.length ? inquiryCustomerPdfs : undefined,
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
      setInquiryCustomerPdfs([]);
      setInquiryPdfError('');
    } catch (e: any) {
      setInquiryError(e?.message || 'Anfrage konnte nicht gesendet werden.');
    } finally {
      setInquiryLoading(false);
    }
  };

  const submitGeneralInquiry = async () => {
    setGeneralInquiryError('');
    setGeneralInquirySuccess('');
    const missing =
      !generalInquiryForm.companyName.trim() ||
      !generalInquiryForm.customerPosition.trim() ||
      !generalInquiryForm.projectStart.trim() ||
      !generalInquiryForm.projectDuration.trim() ||
      !generalInquiryForm.projectLocation.trim() ||
      !generalInquiryForm.budget.trim() ||
      !generalInquiryForm.firstName.trim() ||
      !generalInquiryForm.lastName.trim() ||
      !generalInquiryForm.contactEmail.trim() ||
      !generalInquiryForm.contactPhone.trim() ||
      !generalInquiryForm.searchProfile.trim();
    if (missing) {
      setGeneralInquiryError('Bitte alle Pflichtfelder ausfüllen.');
      return;
    }
    const email = generalInquiryForm.contactEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setGeneralInquiryError('Bitte eine gültige E-Mail-Adresse eingeben.');
      return;
    }
    setGeneralInquiryLoading(true);
    try {
      const fullName = `${generalInquiryForm.firstName.trim()} ${generalInquiryForm.lastName.trim()}`.trim();
      const head = [
        `Firma: ${generalInquiryForm.companyName.trim()}`,
        `Position (Kunde): ${generalInquiryForm.customerPosition.trim()}`,
        `Projektstart: ${generalInquiryForm.projectStart.trim()}`,
        `Projektlaufzeit: ${generalInquiryForm.projectDuration.trim()}`,
        `Projektstandort: ${generalInquiryForm.projectLocation.trim()}`,
        `Budget (EUR): ${generalInquiryForm.budget.trim()} EUR`,
        `Vorname: ${generalInquiryForm.firstName.trim()}`,
        `Nachname: ${generalInquiryForm.lastName.trim()}`,
        `E-Mail: ${email}`,
        `Telefon: ${generalInquiryForm.contactPhone.trim()}`,
      ].join('\n');
      const structuredMessage = `${head}\n\nSuchprofil:\n${generalInquiryForm.searchProfile.trim()}`;
      await candidateService.createInquiry({
        candidateUserId: null,
        contactName: fullName,
        contactEmail: email,
        contactPhone: generalInquiryForm.contactPhone.trim(),
        message: structuredMessage,
        customerAttachments: generalInquiryCustomerPdfs.length ? generalInquiryCustomerPdfs : undefined,
      });
      setGeneralInquirySuccess('Vielen Dank. Ihre Anfrage wurde an das Recruiter-Team gesendet.');
      setGeneralInquiryForm({
        companyName: '',
        customerPosition: '',
        projectStart: '',
        projectDuration: '',
        projectLocation: '',
        budget: '',
        firstName: '',
        lastName: '',
        contactEmail: '',
        contactPhone: '',
        searchProfile: '',
      });
      setGeneralInquiryCustomerPdfs([]);
      setGeneralInquiryPdfError('');
    } catch (e: any) {
      setGeneralInquiryError(e?.message || 'Anfrage konnte nicht gesendet werden.');
    } finally {
      setGeneralInquiryLoading(false);
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

  useEffect(() => {
    if (!selectedCandidate) return;
    const raf = requestAnimationFrame(() => {
      const el = candidateModalBodyRef.current;
      if (el) el.scrollTop = 0;
    });
    return () => cancelAnimationFrame(raf);
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
          <div className="flex flex-wrap items-center justify-start gap-3 sm:gap-4 lg:justify-between">
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col gap-10">
        <div className="w-full rounded-2xl border border-orange-100 bg-gradient-to-br from-orange-50/90 via-white to-slate-50/80 p-4 shadow-sm ring-1 ring-orange-100/60 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-base font-black text-[#101B31]">Keinen passenden Kandidaten gefunden?</p>
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-600">
                Teilen Sie dem Recruiter-Team mit, wen oder welches Profil Sie suchen – wir melden uns bei Ihnen.
              </p>
            </div>
            <Button
              type="button"
              variant="primary"
              className="h-11 shrink-0 px-5 text-xs font-black uppercase tracking-widest sm:self-center"
              onClick={() => {
                setGeneralInquiryError('');
                setGeneralInquirySuccess('');
                setGeneralInquiryPdfError('');
                setShowGeneralInquiryModal(true);
              }}
            >
              Anfrage senden
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-10">
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

          {isLoading && candidates.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center rounded-3xl border border-slate-100 bg-white text-center">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-orange-600" aria-hidden />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.18em] text-slate-500">
                Talente werden geladen
              </p>
            </div>
          ) : filteredAndRanked.length === 0 ? (
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
        </div>
      </main>

      <Modal
        isOpen={showGeneralInquiryModal}
        onClose={() => {
          if (!generalInquiryLoading) {
            setShowGeneralInquiryModal(false);
            setGeneralInquiryError('');
            setGeneralInquirySuccess('');
            setGeneralInquiryPdfError('');
            setGeneralInquiryCustomerPdfs([]);
            setShowGeneralProjectStartCalendar(false);
          }
        }}
        title="Suchprofil an den Recruiter senden"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Alle Felder sind Pflichtfelder. Beschreiben Sie im Suchprofil, welches Talent Sie suchen.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              value={generalInquiryForm.companyName}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, companyName: e.target.value }))}
              placeholder="Firma *"
              className="h-10 sm:col-span-2"
            />
            <Input
              value={generalInquiryForm.customerPosition}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, customerPosition: e.target.value }))}
              placeholder="Ihre Position (z. B. Einkauf, HR, Projektleitung) *"
              className="h-10 sm:col-span-2"
            />
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowGeneralProjectStartCalendar((v) => !v)}
                className="flex h-10 w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-left text-sm text-slate-900 outline-none transition-all focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
              >
                <span className={generalInquiryForm.projectStart ? 'font-medium text-slate-900' : 'text-slate-400'}>
                  {generalInquiryForm.projectStart || 'Projektstart wählen *'}
                </span>
                <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3M5 11h14M5 5h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2z" />
                </svg>
              </button>
              {showGeneralProjectStartCalendar ? (
                <div className="mt-2 rounded-2xl border border-orange-200 bg-white p-3 shadow-xl ring-1 ring-orange-100">
                  <div className="mb-3 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black text-slate-700"
                      onClick={() => setGeneralProjectStartMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                      aria-label="Vorheriger Monat"
                    >
                      ‹
                    </button>
                    <p className="text-sm font-black text-slate-900">{calendarMonthLabel(generalProjectStartMonth)}</p>
                    <button
                      type="button"
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-black text-slate-700"
                      onClick={() => setGeneralProjectStartMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                      aria-label="Nächster Monat"
                    >
                      ›
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black uppercase tracking-wide text-slate-400">
                    {CALENDAR_WEEKDAYS.map((day) => (
                      <span key={day}>{day}</span>
                    ))}
                  </div>
                  <div className="mt-1 grid grid-cols-7 gap-1">
                    {generalProjectStartDays.map((day) => {
                      const label = formatDateDe(day);
                      const inMonth = day.getMonth() === generalProjectStartMonth.getMonth();
                      const selected = generalInquiryForm.projectStart === label;
                      return (
                        <button
                          key={day.toISOString()}
                          type="button"
                          onClick={() => {
                            setGeneralInquiryForm((s) => ({ ...s, projectStart: label }));
                            setShowGeneralProjectStartCalendar(false);
                          }}
                          className={`aspect-square rounded-lg text-xs font-black transition-colors ${
                            selected
                              ? 'bg-orange-600 text-white shadow-md shadow-orange-500/25'
                              : inMonth
                                ? 'bg-slate-50 text-slate-900 hover:bg-orange-50 hover:text-orange-700'
                                : 'bg-white text-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          {day.getDate()}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
            <Input
              value={generalInquiryForm.projectDuration}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, projectDuration: e.target.value }))}
              placeholder="Projektlaufzeit *"
              className="h-10"
            />
            <Input
              value={generalInquiryForm.projectLocation}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, projectLocation: e.target.value }))}
              placeholder="Projektstandort *"
              className="h-10"
            />
            <Input
              type="number"
              min="0"
              value={generalInquiryForm.budget}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, budget: e.target.value }))}
              placeholder="Budget (EUR) *"
              className="h-10 sm:col-span-2"
            />
            <Input
              value={generalInquiryForm.firstName}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, firstName: e.target.value }))}
              placeholder="Vorname *"
              className="h-10"
            />
            <Input
              value={generalInquiryForm.lastName}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, lastName: e.target.value }))}
              placeholder="Nachname *"
              className="h-10"
            />
            <Input
              type="email"
              value={generalInquiryForm.contactEmail}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, contactEmail: e.target.value }))}
              placeholder="E-Mail *"
              className="h-10"
            />
            <Input
              value={generalInquiryForm.contactPhone}
              onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, contactPhone: e.target.value }))}
              placeholder="Telefon *"
              className="h-10"
            />
          </div>
          <Textarea
            value={generalInquiryForm.searchProfile}
            onChange={(e) => setGeneralInquiryForm((s) => ({ ...s, searchProfile: e.target.value }))}
            placeholder="Was suchen Sie? (Rolle, Branche, Standort, Verfügbarkeit …) *"
            rows={5}
            className="min-h-[120px] w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-500/20"
          />
          <div className="rounded-xl border border-dashed border-orange-300/60 bg-orange-50/40 p-3 sm:p-4">
            <FileUpload
              label="Positionsbeschreibung hochladen (PDF, optional)"
              accept="application/pdf"
              multiple
              onChange={handleGeneralInquiryCustomerPdfs}
              files={generalInquiryCustomerPdfs}
              onRemove={(idx) =>
                setGeneralInquiryCustomerPdfs((prev) => prev.filter((_, i) => i !== idx))
              }
              helperText={`Laden Sie Ihre Positionsbeschreibung oder Projektbeschreibung hoch. Bis zu ${MAX_INQUIRY_CUSTOMER_PDFS} PDFs, je max. 10 MB. Noch ${Math.max(0, MAX_INQUIRY_CUSTOMER_PDFS - generalInquiryCustomerPdfs.length)} möglich.`}
              error={generalInquiryPdfError || undefined}
            />
          </div>
          {generalInquiryError && <p className="text-xs font-bold text-red-600">{generalInquiryError}</p>}
          {generalInquirySuccess && <p className="text-xs font-bold text-emerald-700">{generalInquirySuccess}</p>}
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              disabled={generalInquiryLoading}
              onClick={() => {
                setShowGeneralInquiryModal(false);
                setGeneralInquiryError('');
                setGeneralInquirySuccess('');
                setGeneralInquiryCustomerPdfs([]);
                setGeneralInquiryPdfError('');
                setShowGeneralProjectStartCalendar(false);
              }}
            >
              Schließen
            </Button>
            <Button type="button" variant="primary" isLoading={generalInquiryLoading} onClick={() => void submitGeneralInquiry()}>
              Absenden
            </Button>
          </div>
        </div>
      </Modal>

      {selectedCandidate && (
        <Modal
          isOpen={!!selectedCandidate}
          contentRef={candidateModalBodyRef}
          onClose={() => {
            setSelectedCandidate(null);
            setShowInquiryForm(false);
            setInquiryCustomerPdfs([]);
            setInquiryPdfError('');
            setInquiryError('');
            setInquirySuccess('');
            onNavigate('/talents');
          }}
          title={selectedCandidateCodeName ? `Kandidatenprofil · ${selectedCandidateCodeName}` : 'Kandidatenprofil'}
        >
          <div className="min-w-0 max-w-full space-y-5">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs font-black text-slate-400 uppercase">Erfahrung</p><p className="text-lg font-bold text-slate-900">{selectedCandidate.experienceYears} Jahre</p></div>
              <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs font-black text-slate-400 uppercase">Verfügbarkeit</p><p className="text-lg font-bold text-slate-900">{selectedCandidate.availability || '-'}</p></div>
              {selectedCandidate.birthYear && <div className="bg-slate-50 p-4 rounded-xl"><p className="text-xs font-black text-slate-400 uppercase">Geburtsjahr</p><p className="text-lg font-bold text-slate-900">{selectedCandidate.birthYear}</p></div>}
            </div>

            {loadingSelectedDocs ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold text-slate-600">
                Dokumente werden geladen...
              </div>
            ) : (
              selectedDocsList.length > 0 && (
                <div id="mp-candidate-docs" className="scroll-mt-4">
                  <p className="text-xs font-black text-slate-400 uppercase mb-3">Bearbeitete PDFs (anklicken zum Ansehen)</p>
                  <div className="space-y-2">{renderMarketplaceDocButtons()}</div>
                </div>
              )
            )}

            {(selectedCandidate.skills?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Skills</p>
                <div className="flex flex-wrap gap-2">{selectedCandidate.skills.map(skill => <Badge key={skill} variant="orange">{highlightText(skill, debouncedSearch)}</Badge>)}</div>
              </div>
            )}
            {(selectedCandidate.boostedKeywords?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Spezialisierungen</p>
                <div className="flex flex-wrap gap-2">{selectedCandidate.boostedKeywords.map(kw => <Badge key={kw} variant="dark">{kw}</Badge>)}</div>
              </div>
            )}

            {selectedCandidate.about && (
              <div className="min-w-0 max-w-full overflow-hidden rounded-xl bg-slate-50 p-4">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">Über</p>
                <p className="text-sm text-slate-700 [overflow-wrap:anywhere] break-words [word-break:break-word] max-sm:break-all max-sm:max-h-[min(45vh,18rem)] max-sm:overflow-y-auto sm:max-h-none">
                  {anonymizeCandidateText(selectedCandidate.about, selectedCandidate, selectedCandidateCodeName)}
                </p>
              </div>
            )}

            <div className="rounded-xl border border-orange-100 bg-orange-50/50 p-4">
              <Button
                className="w-full sm:w-auto"
                variant="primary"
                onClick={() => {
                  setShowInquiryForm((v) => {
                    if (v) {
                      setInquiryCustomerPdfs([]);
                      setInquiryPdfError('');
                    }
                    return !v;
                  });
                }}
              >
                Ich habe Interesse
              </Button>
              {showInquiryForm && (
                <>
                  <p className="mt-4 mb-3 text-sm font-medium text-slate-700">Bitte alle Pflichtfelder ausfüllen.</p>
                  <div className="mb-4 rounded-xl border border-dashed border-orange-300/60 bg-white/80 p-3 sm:p-4">
                    <FileUpload
                      label="PDF-Unterlagen (optional)"
                      accept="application/pdf"
                      multiple
                      onChange={handleInquiryCustomerPdfs}
                      files={inquiryCustomerPdfs}
                      onRemove={(idx) =>
                        setInquiryCustomerPdfs((prev) => prev.filter((_, i) => i !== idx))
                      }
                      helperText={`Bis zu ${MAX_INQUIRY_CUSTOMER_PDFS} PDFs, je max. 10 MB. Noch ${Math.max(0, MAX_INQUIRY_CUSTOMER_PDFS - inquiryCustomerPdfs.length)} möglich.`}
                      error={inquiryPdfError || undefined}
                    />
                  </div>
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
        <div className="fixed inset-0 z-[100] flex flex-col bg-slate-900 pb-[env(safe-area-inset-bottom)]">
          <div className="flex flex-wrap items-center justify-end gap-2 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] bg-slate-800 border-b border-slate-700 shrink-0">
            <span className="text-white font-bold truncate min-w-0 flex-1 basis-full sm:basis-auto sm:flex-none">{pdfViewerTitle}</span>
            <a
              href={pdfViewerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-orange-600 px-3 py-2 text-xs font-bold uppercase tracking-wide text-white hover:bg-orange-500 shrink-0"
            >
              In neuem Tab
            </a>
            <Button variant="ghost" size="sm" className="text-white hover:bg-slate-700 shrink-0" onClick={closePdfViewer}>
              Schließen
            </Button>
          </div>
          <p className="md:hidden text-center text-[11px] leading-snug text-slate-400 px-3 py-2 bg-slate-950/80 border-b border-slate-800">
            Zeigt die Vorschau nichts? „In neuem Tab“ öffnet die PDF zuverlässig auf dem Handy.
          </p>
          <iframe
            src={pdfViewerUrl}
            title={pdfViewerTitle}
            className="flex-1 w-full min-h-0 border-0 touch-pan-y"
          />
        </div>
      )}
    </div>
  );
};

export default TalentMarketplace;
