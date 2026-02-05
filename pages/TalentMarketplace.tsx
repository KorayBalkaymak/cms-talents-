
import React, { useState, useMemo, useEffect } from 'react';
import { CandidateProfile } from '../types';
import { rankCandidates, highlightText } from '../services/SearchService';
import { Input, Avatar, Badge, Button, Modal, EmptyState } from '../components/UI';
import { INDUSTRIES, AVAILABILITY_OPTIONS } from '../constants';
import { User } from '../types';

interface TalentMarketplaceProps {
  candidates: CandidateProfile[];
  selectedId?: string;
  onNavigate: (path: string) => void;
  user?: User | null;
}

const TalentMarketplace: React.FC<TalentMarketplaceProps> = (props) => {
  const { candidates, selectedId, onNavigate } = props;
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filterIndustry, setFilterIndustry] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [filterExp, setFilterExp] = useState(0);
  const [sortBy, setSortBy] = useState<'relevance' | 'newest' | 'experience'>('relevance');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);

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
    <div className="min-h-screen bg-slate-50 font-inter">
      {/* Navigation Bar */}
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">

          {/* Logo & Brand */}
          <div className="flex items-center gap-3 cursor-pointer shrink-0" onClick={() => onNavigate('/')}>
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-900/50">
              <span className="text-white font-black italic text-sm">CT</span>
            </div>
            <span className="text-lg font-black text-white tracking-tighter hidden sm:block">CMS <span className="text-orange-500">Talents</span></span>
          </div>

          {/* Search Bar (Centered) */}
          <div className="flex-1 max-w-lg mx-4">
            <div className="relative group">
              <svg className="absolute left-3 top-2.5 w-4 h-4 text-slate-500 group-focus-within:text-orange-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              <input
                type="text"
                placeholder="Suche..."
                className="w-full pl-10 pr-4 py-2 bg-slate-800 border-2 border-slate-700 text-white text-sm rounded-xl outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all placeholder:text-slate-500 font-medium"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          {/* Right Actions (Logged In vs Guest) */}
          <div className="flex items-center gap-3 shrink-0">
            {props.user ? (
              // LOGGED IN NAVIGATION
              <>
                <span className="text-xs font-bold text-slate-400 hidden md:block mr-2">Hallo, {props.user.firstName || 'User'}</span>

                {props.user.role === 'admin' || props.user.role === 'recruiter' ? (
                  <Button size="sm" variant="primary" onClick={() => onNavigate('/recruiter/dashboard')} className="h-9 text-xs px-4">
                    ZUM DASHBOARD
                  </Button>
                ) : (
                  <Button size="sm" variant="primary" onClick={() => onNavigate('/candidate/profile')} className="h-9 text-xs px-4">
                    MEIN PROFIL
                  </Button>
                )}

                <button onClick={handleLogout} className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors" title="Abmelden">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
                </button>
              </>
            ) : (
              // GUEST NAVIGATION
              <>
                <button onClick={() => onNavigate('/recruiter/auth')} className="text-[10px] font-black text-slate-400 hover:text-white uppercase tracking-widest hidden sm:block">Für Arbeitgeber</button>
                <Button size="sm" onClick={() => onNavigate('/candidate/auth')} className="h-9 text-xs px-4">
                  LOGIN / REGISTRIEREN
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex flex-col lg:flex-row gap-10">
        {/* Filters */}
        <aside className="lg:w-72 flex-shrink-0 space-y-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Branche</h4>
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

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Verfügbarkeit</h4>
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

          <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-4">Erfahrung ({filterExp}+ J.)</h4>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {filteredAndRanked.map(({ candidate, score }) => (
                <div
                  key={candidate.userId}
                  className="bg-white p-8 rounded-[2rem] border-2 border-transparent hover:border-orange-500 shadow-xl shadow-slate-200/50 transition-all cursor-pointer flex flex-col group"
                  onClick={() => { setSelectedCandidate(candidate); onNavigate(`/talents/${candidate.userId}`); }}
                >
                  <div className="flex items-start gap-5 mb-6">
                    <Avatar seed={candidate.firstName + candidate.lastName} size="md" imageUrl={candidate.profileImageUrl} className="group-hover:scale-110 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-black text-slate-900 tracking-tight leading-tight">
                        {highlightText(`${candidate.firstName} ${candidate.lastName}`, debouncedSearch)}
                      </h3>
                      <div className="text-xs font-bold text-slate-400 flex items-center gap-1 mt-1">
                        <svg className="w-3 h-3 text-orange-500" fill="currentColor" viewBox="0 0 20 20"><path d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z"></path></svg>
                        {highlightText(candidate.city, debouncedSearch)}
                      </div>
                    </div>
                    {score > 0 && <Badge variant="orange" className="h-6">Match {Math.min(100, score * 10)}%</Badge>}
                  </div>

                  <div className="space-y-4 mb-6 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {candidate.industry && <Badge variant="slate" className="bg-slate-50 text-slate-900 border-none px-3">{candidate.industry}</Badge>}
                      <Badge variant="slate" className="bg-slate-50 text-slate-900 border-none px-3">{candidate.experienceYears} J. Exp</Badge>
                      {candidate.availability && <Badge variant="green" className="px-3">{candidate.availability}</Badge>}
                    </div>
                    {candidate.about && (
                      <p className="text-slate-500 text-sm font-medium line-clamp-2 leading-relaxed italic">
                        "{highlightText(candidate.about, debouncedSearch)}"
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5 border-t border-slate-50 pt-4">
                    {candidate.skills.slice(0, 4).map(skill => (
                      <span key={skill} className="text-[10px] font-black uppercase tracking-tighter text-slate-400">
                        #{highlightText(skill, debouncedSearch)}
                      </span>
                    ))}
                    {candidate.skills.length > 4 && <span className="text-[10px] font-black text-orange-500">+{candidate.skills.length - 4}</span>}
                  </div>
                </div>
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
            </div>

            {selectedCandidate.about && (
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="text-xs font-black text-slate-400 uppercase mb-2">Über</p>
                <p className="text-slate-700">{selectedCandidate.about}</p>
              </div>
            )}

            {selectedCandidate.skills.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Skills</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.skills.map(skill => (
                    <Badge key={skill} variant="orange">{highlightText(skill, debouncedSearch)}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedCandidate.boostedKeywords.length > 0 && (
              <div>
                <p className="text-xs font-black text-slate-400 uppercase mb-3">Spezialisierungen</p>
                <div className="flex flex-wrap gap-2">
                  {selectedCandidate.boostedKeywords.map(kw => (
                    <Badge key={kw} variant="dark">{kw}</Badge>
                  ))}
                </div>
              </div>
            )}

            {selectedCandidate.socialLinks.length > 0 && (
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

            <div className="pt-6 border-t border-slate-100">
              <Button className="w-full py-4" variant="primary" onClick={() => onNavigate('/recruiter/auth')}>
                Recruiter? Vollständiges Profil ansehen
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default TalentMarketplace;
