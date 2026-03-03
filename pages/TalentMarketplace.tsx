
import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { CandidateProfile, UserRole } from '../types';
import { rankCandidates, highlightText } from '../services/SearchService';
import { candidateService } from '../services/CandidateService';
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

const CandidateCard = memo(({ item, search, onSelect }: { item: MatchItem; search: string; onSelect: (c: CandidateProfile) => void }) => {
  const { candidate, score } = item;
  const skills = candidate.skills ?? [];
  const handleClick = useCallback(() => { onSelect(candidate); }, [candidate, onSelect]);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      className="bg-white p-6 rounded-xl border border-slate-200 hover:border-slate-300 hover:shadow-md transition-all cursor-pointer flex flex-col"
      style={{ contentVisibility: 'auto', contain: 'layout paint' }}
    >
      <div className="flex items-start gap-5 mb-6">
        <Avatar seed={candidate.firstName + candidate.lastName} size="md" imageUrl={candidate.profileImageUrl} className="shrink-0" />
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 tracking-tight leading-tight">
            {highlightText(`${candidate.firstName} ${candidate.lastName}`, search)}
          </h3>
          <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-1">
            <svg className="w-3 h-3 text-orange-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"></path></svg>
            {highlightText(candidate.city, search)}
          </div>
        </div>
        {score > 0 && <Badge variant="orange" className="h-6 shrink-0">Match {Math.min(100, score * 10)}%</Badge>}
      </div>
      <div className="space-y-4 mb-6 flex-1">
        <div className="flex flex-wrap gap-2">
          {candidate.industry && <Badge variant="slate" className="bg-slate-50 text-slate-900 border-none px-3">{candidate.industry}</Badge>}
          <Badge variant="slate" className="bg-slate-50 text-slate-900 border-none px-3">{candidate.experienceYears} J. Exp</Badge>
          {candidate.availability && <Badge variant="green" className="px-3">{candidate.availability}</Badge>}
        </div>
        {candidate.about && (
          <p className="text-slate-500 text-sm font-medium line-clamp-2 leading-relaxed italic">
            "{highlightText(candidate.about, search)}"
          </p>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-4">
        {skills.slice(0, 4).map(skill => (
          <span key={skill} className="text-xs font-medium text-slate-500">
            #{highlightText(skill, search)}
          </span>
        ))}
        {skills.length > 4 && <span className="text-xs font-medium text-orange-600">+{skills.length - 4}</span>}
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
  const [documentLoading, setDocumentLoading] = useState<string | null>(null);
  const [pdfViewerUrl, setPdfViewerUrl] = useState<string | null>(null);
  const [pdfViewerTitle, setPdfViewerTitle] = useState<string>('');

  // PDF in Modal mit iframe anzeigen (zuverlässig, keine weiße Seite)
  const openDocument = async (userId: string, docType: string, docName: string) => {
    setDocumentLoading(docName);
    try {
      const docs = await candidateService.getDocuments(userId);
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
    setSelectedCandidate(candidate);
    onNavigate(`/talents/${candidate.userId}`);
  }, [onNavigate]);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Open selected candidate modal
  useEffect(() => {
    if (selectedId) {
      const found = candidates.find(c => c.userId === selectedId);
      if (found) setSelectedCandidate(found);
    }
  }, [selectedId, candidates]);

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

  const handleLogout = () => {
    localStorage.removeItem('cms_user');
    window.location.hash = '/';
    window.location.reload();
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Navigation Bar */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => onNavigate('/')}>
            <div>
              <img src="/1adef99a-1986-43bc-acb8-278472ee426c.png" alt="CMS Talents" className="h-9 sm:h-10 w-auto object-contain" />
              <p className="hidden sm:block text-xs text-slate-500 mt-0.5">Talente entdecken – für alle sichtbar</p>
            </div>
          </div>

          <div className="flex-1 max-w-lg mx-4">
            <div className="relative group">
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-400 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                placeholder="Suche nach Skills, Ort, Branche…"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-400"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {props.user ? (
              <>
                <span className="text-sm text-slate-500 hidden md:block mr-1">Hallo, {props.user.firstName || 'User'}</span>
                {(props.user.role === UserRole.ADMIN || props.user.role === UserRole.RECRUITER) ? (
                  <Button size="sm" variant="primary" onClick={() => onNavigate('/recruiter/dashboard')} className="h-9 text-sm px-4">
                    Dashboard
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => onNavigate('/candidate/profile')} className="h-9 text-sm px-4">
                    Mein Profil
                  </Button>
                )}
                <button type="button" onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-200 transition-colors" title="Abmelden">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </>
            ) : (
              <>
                <button type="button" onClick={() => onNavigate('/recruiter/auth')} className="text-sm font-medium text-slate-600 hover:text-slate-900 hidden sm:block">Für Arbeitgeber</button>
                <Button size="sm" onClick={() => onNavigate('/candidate/auth')} className="h-9 text-sm px-4">
                  Anmelden
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row gap-10" style={{ contain: 'paint' }}>
        {/* Filters */}
        <aside className="lg:w-72 flex-shrink-0 space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Branche</h4>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                <input type="radio" name="industry" checked={filterIndustry === ''} onChange={() => setFilterIndustry('')} className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500" />
                <span className="group-hover:text-slate-900">Alle Branchen</span>
              </label>
              {INDUSTRIES.map(ind => (
                <label key={ind} className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                  <input type="radio" name="industry" checked={filterIndustry === ind} onChange={() => setFilterIndustry(ind)} className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500" />
                  <span className="group-hover:text-slate-900">{ind}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Verfügbarkeit</h4>
            <div className="space-y-2.5">
              <label className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                <input type="radio" name="availability" checked={filterAvailability === ''} onChange={() => setFilterAvailability('')} className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500" />
                <span className="group-hover:text-slate-900">Alle</span>
              </label>
              {AVAILABILITY_OPTIONS.map(opt => (
                <label key={opt} className="flex items-center gap-3 text-sm text-slate-600 cursor-pointer font-bold group">
                  <input type="radio" name="availability" checked={filterAvailability === opt} onChange={() => setFilterAvailability(opt)} className="w-4 h-4 text-orange-600 border-slate-300 focus:ring-orange-500" />
                  <span className="group-hover:text-slate-900">{opt}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="bg-white p-5 rounded-xl border border-slate-200">
            <h4 className="text-sm font-semibold text-slate-900 mb-4">Erfahrung ({filterExp}+ J.)</h4>
            <input
              type="range" min="0" max="20"
              className="w-full h-2 bg-slate-100 rounded-lg appearance-none cursor-pointer accent-orange-600"
              value={filterExp}
              onChange={(e) => setFilterExp(parseInt(e.target.value))}
            />
            <div className="flex justify-between text-[10px] font-black text-slate-400 mt-2 uppercase tracking-tighter">
              <span>Junior</span>
              <span>Senior</span>
              <span>Expert</span>
            </div>
          </div>
        </aside>

        {/* Results */}
        <div className="flex-1">
          <div className="mb-8 flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter leading-none">
                {filteredAndRanked.length} TALENTE
              </h2>
              {debouncedSearch && <p className="text-slate-400 font-bold mt-1 uppercase text-xs tracking-widest">Suche für: "{debouncedSearch}"</p>}
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sort:</span>
              <select
                className="bg-transparent border-none text-xs font-black text-orange-600 outline-none cursor-pointer uppercase tracking-widest"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
              >
                <option value="relevance">RELEVANZ</option>
                <option value="newest">NEUESTE</option>
                <option value="experience">ERFAHRUNG</option>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8" style={{ contain: 'layout' }}>
              {filteredAndRanked.map((item) => (
                <CandidateCard
                  key={item.candidate.userId}
                  item={item}
                  search={debouncedSearch}
                  onSelect={handleSelectCandidate}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Candidate Detail Modal */}
      {selectedCandidate && (
        <Modal isOpen={!!selectedCandidate} onClose={() => { setSelectedCandidate(null); onNavigate('/talents'); }} title="Kandidatenprofil">
          <div className="space-y-6">
            <div className="flex items-center gap-6 p-6 bg-slate-900 rounded-[2rem] text-white">
              <Avatar seed={selectedCandidate.firstName + selectedCandidate.lastName} size="lg" imageUrl={selectedCandidate.profileImageUrl} />
              <div className="flex-1">
                <h3 className="text-2xl font-black tracking-tight">{selectedCandidate.firstName} {selectedCandidate.lastName}</h3>
                <p className="text-orange-500 font-bold uppercase text-xs tracking-widest">{selectedCandidate.industry}</p>
                <p className="text-slate-400 text-sm mt-1">{selectedCandidate.city}, {selectedCandidate.country}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-xs font-black text-slate-400 uppercase">Erfahrung</p>
                <p className="text-lg font-bold text-slate-900">{selectedCandidate.experienceYears} Jahre</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-xs font-black text-slate-400 uppercase">Verfügbarkeit</p>
                <p className="text-lg font-bold text-slate-900">{selectedCandidate.availability || '-'}</p>
              </div>
              {selectedCandidate.birthYear && (
                <div className="bg-slate-50 p-4 rounded-xl">
                  <p className="text-xs font-black text-slate-400 uppercase">Geburtsjahr</p>
                  <p className="text-lg font-bold text-slate-900">{selectedCandidate.birthYear}</p>
                </div>
              )}
            </div>

            {(selectedCandidate.address || selectedCandidate.zipCode || selectedCandidate.phoneNumber) && (
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">Kontakt / Adresse</p>
                <div className="space-y-1 text-slate-700">
                  {selectedCandidate.address && <p>{selectedCandidate.address}</p>}
                  {(selectedCandidate.zipCode || selectedCandidate.city) && (
                    <p>{[selectedCandidate.zipCode, selectedCandidate.city].filter(Boolean).join(' ')}</p>
                  )}
                  {selectedCandidate.phoneNumber && (
                    <p><a href={`tel:${selectedCandidate.phoneNumber}`} className="text-orange-600 hover:underline">{selectedCandidate.phoneNumber}</a></p>
                  )}
                </div>
              </div>
            )}

            {selectedCandidate.about && (
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">Über</p>
                <p className="text-slate-700">{selectedCandidate.about}</p>
              </div>
            )}

            {(selectedCandidate.skills?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.skills.map(skill => (
                    <Badge key={skill} variant="orange">{highlightText(skill, debouncedSearch)}</Badge>
                  ))}
                </div>
              </div>
            )}

            {(selectedCandidate.boostedKeywords?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Spezialisierungen</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.boostedKeywords.map(kw => (
                    <Badge key={kw} variant="dark">{kw}</Badge>
                  ))}
                </div>
              </div>
            )}

            {(selectedCandidate.socialLinks?.length ?? 0) > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Links</p>
                <div className="space-y-2">
                  {selectedCandidate.socialLinks.map((link, idx) => (
                    <a key={idx} href={link.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-orange-600 hover:underline">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      {link.label}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {selectedCandidate.documents && selectedCandidate.documents.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Dokumente (anklicken zum Ansehen)</p>
                <div className="space-y-2">
                  {selectedCandidate.documents.map((doc, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => openDocument(selectedCandidate.userId, doc.type, doc.name)}
                      disabled={!!documentLoading}
                      className="flex items-center gap-2 w-full text-left p-3 rounded-xl bg-slate-50 hover:bg-orange-50 border border-slate-100 hover:border-orange-200 transition-colors group"
                    >
                      <span className="w-10 h-10 rounded-lg bg-slate-200 group-hover:bg-orange-100 flex items-center justify-center shrink-0">
                        <svg className="w-5 h-5 text-slate-600 group-hover:text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                      </span>
                      <div className="flex-1 min-w-0">
                        <span className="text-slate-500 text-xs uppercase block">
                          {doc.type === 'cv' ? 'Lebenslauf (CV)' : doc.type === 'certificate' ? 'Zertifikat' : 'Qualifikation'}
                        </span>
                        <span className="font-bold text-slate-900 truncate block">{doc.name}</span>
                      </div>
                      {documentLoading === doc.name ? (
                        <span className="text-xs text-slate-400">Wird geladen…</span>
                      ) : (
                        <svg className="w-5 h-5 text-orange-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Vollständiges Profil ist für alle sichtbar (Zuschauer, Kunden, Interessenten). Optional: Arbeitgeber-Link. */}
            {props.user && (props.user.role === UserRole.RECRUITER || props.user.role === UserRole.ADMIN) && (
              <div className="pt-6 border-t border-slate-100">
                <Button className="w-full py-4" variant="primary" onClick={() => { setSelectedCandidate(null); onNavigate('/recruiter/dashboard'); }}>
                  Zum Recruiter-Dashboard
                </Button>
              </div>
            )}
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
