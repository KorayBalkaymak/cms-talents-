
import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, CandidateProfile, CandidateStatus, CandidateDocuments, AuditLog, getActiveRecruiterEditing } from '../types';
import { Button, Avatar, Badge, Modal, Tabs, EmptyState, Input, Select, Textarea } from '../components/UI';
import { candidateService } from '../services/CandidateService';
import { auditService } from '../services/AuditService';
import { INDUSTRIES, AVAILABILITY_OPTIONS } from '../constants';
import { documentService } from '../services/DocumentService';

interface RecruiterDashboardProps {
  user: User;
  candidates: CandidateProfile[];
  onAdminAction: (userUuid: string, action: 'delete' | 'status' | 'publish' | 'cv_reviewed', newStatus?: CandidateStatus, performerId?: string) => Promise<void> | void;
  onUpdateCandidate?: (candidate: CandidateProfile) => void;
  onRefreshCandidates?: () => Promise<void> | void;
  onLogout: () => void;
}

const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ user, candidates, onAdminAction, onUpdateCandidate, onRefreshCandidates, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<CandidateDocuments | null>(null);
  const [activeTab, setActiveTab] = useState('candidates');
  const [modalTab, setModalTab] = useState('profile');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);
  const [isSavingDocs, setIsSavingDocs] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [claimBusyUserId, setClaimBusyUserId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);

  // Document Preview State
  const [previewDoc, setPreviewDoc] = useState<{ name: string; data: string } | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<CandidateProfile | null>(null);
  const [editTab, setEditTab] = useState('general');

  // Input States
  const [newSkill, setNewSkill] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });

  useEffect(() => {
    if (activeTab === 'audit') {
      loadAuditLogs();
    }
  }, [activeTab, candidates]);

  useEffect(() => {
    if (!selectedCandidate) return;
    const fresh = candidates.find((c) => c.userId === selectedCandidate.userId);
    if (fresh) setSelectedCandidate(fresh);
  }, [candidates, selectedCandidate]);

  // Andere Recruiter sehen Meldungen nach kurzer Zeit automatisch aktualisiert
  useEffect(() => {
    if (activeTab !== 'candidates' || !onRefreshCandidates) return;
    const id = window.setInterval(() => {
      void onRefreshCandidates();
    }, 35000);
    return () => window.clearInterval(id);
  }, [activeTab, onRefreshCandidates]);

  const handleRecruiterEditingClaim = async (cand: CandidateProfile) => {
    const editing = getActiveRecruiterEditing(cand);
    setClaimError(null);
    try {
      setClaimBusyUserId(cand.userId);
      if (editing?.userId === user.id) {
        await candidateService.setRecruiterEditingClaim(cand.userId, false);
      } else if (editing) {
        if (
          !window.confirm(
            `${editing.label} bearbeitet diesen Kandidaten gerade (Team-Sicht). Wirklich übernehmen? Nur nach Absprache.`
          )
        ) {
          return;
        }
        await candidateService.setRecruiterEditingClaim(cand.userId, true);
      } else {
        await candidateService.setRecruiterEditingClaim(cand.userId, true);
      }
      if (onRefreshCandidates) await onRefreshCandidates();
    } catch (e: any) {
      setClaimError(e?.message || 'Bearbeitungs-Meldung fehlgeschlagen.');
    } finally {
      setClaimBusyUserId(null);
    }
  };

  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await auditService.getAll();
      setAuditLogs(logs);
    } catch (e) { console.error(e); } finally { setIsLoadingAudit(false); }
  };

  const isAdmin = user.role === UserRole.ADMIN;
  // Recruiter dürfen NICHT Stammdaten/Skills/Links bearbeiten (nur Admin).
  const canEdit = isAdmin;

  // Recruiter sollen nicht alle Entwürfe/leer angelegte Profile sehen.
  // Sichtbar: eingereicht ODER bereits veröffentlicht. Admins sehen alles.
  const visibleCandidates = isAdmin
    ? candidates
    : candidates.filter((c) => !!c.isSubmitted || !!c.isPublished || c.status === CandidateStatus.ACTIVE);

  const filtered = visibleCandidates
    .slice()
    .sort((a, b) => {
      // Show submitted first
      const aSub = !!a.isSubmitted;
      const bSub = !!b.isSubmitted;
      if (aSub && !bSub) return -1;
      if (bSub && !aSub) return 1;
      return 0;
    })
    .filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const industryGroups = useMemo(() => {
    const sortInGroup = (arr: CandidateProfile[]) =>
      [...arr].sort((a, b) => {
        const aSub = !!a.isSubmitted;
        const bSub = !!b.isSubmitted;
        if (aSub && !bSub) return -1;
        if (bSub && !aSub) return 1;
        return `${a.firstName} ${a.lastName}`.localeCompare(
          `${b.firstName} ${b.lastName}`,
          'de',
          { sensitivity: 'base' }
        );
      });

    const map = new Map<string, CandidateProfile[]>();
    for (const c of filtered) {
      const key = (c.industry || '').trim() || 'Ohne Branche';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }

    const groups = Array.from(map.entries()).map(([industry, list]) => ({
      industry,
      candidates: sortInGroup(list),
    }));

    groups.sort((a, b) => {
      if (a.industry === 'Ohne Branche') return 1;
      if (b.industry === 'Ohne Branche') return -1;
      return a.industry.localeCompare(b.industry, 'de', { sensitivity: 'base' });
    });

    return groups;
  }, [filtered]);

  const handleViewCandidate = async (candidate: CandidateProfile) => {
    setSelectedCandidate(candidate);
    setEditForm(JSON.parse(JSON.stringify(candidate)));
    setIsEditing(false);
    setModalTab('profile');
    setClaimError(null);
    setDocError(null);
    const docs = await candidateService.getDocuments(candidate.userId);
    setCandidateDocs(docs || null);
  };

  const canShowPublishFor = (c: CandidateProfile | null) => {
    if (!c) return false;
    if (c.isPublished) return false;
    // Normal: eingereicht → freigeben
    if (c.isSubmitted) return true;
    // Legacy: aktiv aber nicht published → freigeben ermöglichen
    if (c.status === CandidateStatus.ACTIVE) return true;
    return false;
  };

  const publishDisabledReason = (c: CandidateProfile | null) => {
    if (!c) return 'Bitte Kandidat öffnen.';
    if (isPublishing) return 'Bitte warten…';
    if (!candidateDocs?.cvPdf) return 'Bitte zuerst einen Lebenslauf hochladen.';
    return null;
  };

  const handlePublish = async (c: CandidateProfile | null) => {
    if (!c) return;
    setDocError(null);
    setIsPublishing(true);
    try {
      let docs = candidateDocs;
      if (!docs || selectedCandidate?.userId !== c.userId) {
        docs = await candidateService.getDocuments(c.userId);
        if (selectedCandidate?.userId === c.userId) setCandidateDocs(docs || null);
      }

      if (!docs?.cvPdf) {
        setDocError('Bitte zuerst einen Lebenslauf hochladen.');
        return;
      }

      // Ensure CV review flag exists (so Recruiter can always "Freigeben" after reviewing).
      if (!c.cvReviewedAt) {
        await Promise.resolve(onAdminAction(c.userId, 'cv_reviewed', undefined, user.id));
      }

      await Promise.resolve(onAdminAction(c.userId, 'publish', undefined, user.id));
    } catch (e: any) {
      setDocError(e?.message || 'Freigabe fehlgeschlagen.');
    } finally {
      setIsPublishing(false);
    }
  };

  const saveDocs = async (nextDocs: CandidateDocuments) => {
    if (!selectedCandidate) return;
    setIsSavingDocs(true);
    setDocError(null);
    try {
      await candidateService.updateDocuments(nextDocs);
      const fresh = await candidateService.getDocuments(selectedCandidate.userId);
      setCandidateDocs(fresh || null);
      if (onRefreshCandidates) await onRefreshCandidates();
    } catch (e: any) {
      setDocError(e?.message || 'Fehler beim Speichern der Dokumente');
    } finally {
      setIsSavingDocs(false);
    }
  };

  const handleReplaceCv = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCandidate) return;
    const file = files[0];
    const up = await documentService.uploadPdf(file);
    if (!up.success || !up.data || !up.name) {
      setDocError(up.error || 'PDF-Upload fehlgeschlagen.');
      return;
    }
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({ ...base, userId: selectedCandidate.userId, cvPdf: { name: up.name, data: up.data } });
  };

  const handleRemoveCv = async () => {
    if (!selectedCandidate) return;
    if (!window.confirm('Lebenslauf wirklich entfernen?')) return;
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({ ...base, userId: selectedCandidate.userId, cvPdf: undefined });
  };

  const handleAddCertificates = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCandidate) return;
    const results = await documentService.uploadMultiplePdfs(files);
    if (!results.length) {
      setDocError('Keine gültigen PDFs ausgewählt.');
      return;
    }
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({
      ...base,
      userId: selectedCandidate.userId,
      certificates: [...(base.certificates || []), ...results]
    });
  };

  const handleRemoveCertificate = async (idx: number) => {
    if (!selectedCandidate) return;
    if (!window.confirm('Zertifikat wirklich entfernen?')) return;
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({
      ...base,
      userId: selectedCandidate.userId,
      certificates: (base.certificates || []).filter((_, i) => i !== idx)
    });
  };

  const handleReplaceCertificate = async (idx: number, files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCandidate) return;
    const file = files[0];
    const up = await documentService.uploadPdf(file);
    if (!up.success || !up.data || !up.name) {
      setDocError(up.error || 'PDF-Upload fehlgeschlagen.');
      return;
    }
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    const next = (base.certificates || []).map((d, i) => i === idx ? { name: up.name!, data: up.data! } : d);
    await saveDocs({ ...base, userId: selectedCandidate.userId, certificates: next });
  };

  const handleAddQualifications = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCandidate) return;
    const results = await documentService.uploadMultiplePdfs(files);
    if (!results.length) {
      setDocError('Keine gültigen PDFs ausgewählt.');
      return;
    }
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({
      ...base,
      userId: selectedCandidate.userId,
      qualifications: [...(base.qualifications || []), ...results]
    });
  };

  const handleRemoveQualification = async (idx: number) => {
    if (!selectedCandidate) return;
    if (!window.confirm('Qualifikation wirklich entfernen?')) return;
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({
      ...base,
      userId: selectedCandidate.userId,
      qualifications: (base.qualifications || []).filter((_, i) => i !== idx)
    });
  };

  const handleReplaceQualification = async (idx: number, files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCandidate) return;
    const file = files[0];
    const up = await documentService.uploadPdf(file);
    if (!up.success || !up.data || !up.name) {
      setDocError(up.error || 'PDF-Upload fehlgeschlagen.');
      return;
    }
    const base: CandidateDocuments = candidateDocs || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    const next = (base.qualifications || []).map((d, i) => i === idx ? { name: up.name!, data: up.data! } : d);
    await saveDocs({ ...base, userId: selectedCandidate.userId, qualifications: next });
  };

  // Only used within Edit Mode now, or via Save button?
  // Actually, we process everything via onUpdateCandidate in Edit Mode.
  // We keep handleDelete for the Danger Zone (which is immediate but specific).

  const handleDelete = () => {
    if (selectedCandidate && isAdmin) {
      // Confirmation could be added here
      if (window.confirm("Sind Sie sicher? Dies kann nicht rückgängig gemacht werden.")) {
        onAdminAction(selectedCandidate.userId, 'delete', undefined, user.id);
        setSelectedCandidate(null);
      }
    }
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    if (editForm) { setEditForm({ ...editForm, [e.target.name]: e.target.value }); }
  };
  const handleEditNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (editForm) { setEditForm({ ...editForm, [e.target.name]: parseInt(e.target.value) || 0 }); }
  };
  const addSkill = () => {
    if (newSkill.trim() && editForm && !editForm.skills.includes(newSkill.trim())) {
      setEditForm({ ...editForm, skills: [...editForm.skills, newSkill.trim()] });
      setNewSkill('');
    }
  };
  const removeSkill = (sk: string) => {
    if (editForm) setEditForm({ ...editForm, skills: editForm.skills.filter(s => s !== sk) });
  };
  const addLink = () => {
    if (newLink.label && newLink.url && editForm) {
      setEditForm({ ...editForm, socialLinks: [...editForm.socialLinks, { ...newLink }] });
      setNewLink({ label: '', url: '' });
    }
  };
  const removeLink = (idx: number) => {
    if (editForm) {
      const nl = [...editForm.socialLinks]; nl.splice(idx, 1);
      setEditForm({ ...editForm, socialLinks: nl });
    }
  };

  const handleSaveEdit = () => {
    if (editForm && onUpdateCandidate) {
      onUpdateCandidate(editForm);
      setSelectedCandidate(editForm);
      setIsEditing(false);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch { return dateStr; }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex font-inter">
      {/* Sidebar - SCALED DOWN */}
      <aside className="w-64 bg-slate-900 text-slate-300 hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-3 text-white mb-8">
            <img src="/1adef99a-1986-43bc-acb8-278472ee426c.png" alt="CMS Talents" className="h-12 w-auto object-contain" />
          </div>
          <nav className="space-y-2">
            <button onClick={() => setActiveTab('candidates')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all border ${activeTab === 'candidates' ? 'bg-slate-800 text-orange-500 border-slate-700' : 'text-slate-500 border-transparent hover:bg-slate-800 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path></svg>
              TALENTS
            </button>
            <button onClick={() => setActiveTab('audit')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-xs transition-all border ${activeTab === 'audit' ? 'bg-slate-800 text-orange-500 border-slate-700' : 'text-slate-500 border-transparent hover:bg-slate-800 hover:text-white'}`}>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path></svg>
              AUDIT LOG
            </button>
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-white text-xs">{user.email.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white truncate uppercase tracking-tight">{user.role === UserRole.ADMIN ? 'ADMIN' : 'RECRUITER'}</div>
              <div className="text-[10px] text-slate-500 font-bold truncate">{user.email}</div>
            </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-black text-slate-500 hover:text-orange-500 transition-colors uppercase tracking-widest flex items-center gap-2">Logout</button>
        </div>
      </aside>

      {/* Main Content - SCALED DOWN */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-slate-100 px-6 flex items-center justify-between shadow-sm relative z-10">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-black text-slate-900 tracking-tight uppercase">{activeTab === 'candidates' ? 'Candidates' : 'Audit Log'}</h1>
            {activeTab === 'audit' && (
              <button onClick={loadAuditLogs} className="p-1.5 text-slate-400 hover:text-orange-500 transition-colors" title="Refresh Log">
                <svg className={`w-4 h-4 ${isLoadingAudit ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
              </button>
            )}
          </div>
          {activeTab === 'candidates' && (
            <div className="flex items-center gap-6">
              <div className="relative group">
                <input type="text" placeholder="Suchen..." className="pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-orange-500/10 focus:border-orange-500 w-64 transition-all" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                <svg className="absolute left-3 top-2 w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
          {activeTab === 'candidates' && claimError && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-800">
              <span>{claimError}</span>
              <button type="button" className="shrink-0 text-[10px] font-black uppercase tracking-wide text-red-600 underline" onClick={() => setClaimError(null)}>
                Schließen
              </button>
            </div>
          )}
          {activeTab === 'candidates' ? (
            filtered.length === 0 ? <EmptyState title="Keine Kandidaten" description="Nichts gefunden." /> : (
              <div className="space-y-8">
                <p className="text-[11px] font-bold text-slate-500 -mt-2 mb-1">
                  {industryGroups.length} {industryGroups.length === 1 ? 'Branche' : 'Branchen'} · {filtered.length}{' '}
                  {filtered.length === 1 ? 'Kandidat' : 'Kandidaten'}
                </p>
                {industryGroups.map(({ industry, candidates }) => (
                  <section
                    key={industry}
                    className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                  >
                    <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-5 py-4 text-white">
                      <div
                        className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-orange-400 to-orange-600"
                        aria-hidden
                      />
                      <div className="flex min-w-0 flex-1 items-center gap-3 pl-2">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                          <svg className="h-5 w-5 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-sm font-black tracking-tight text-white md:text-base">{industry}</h2>
                          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Branche</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-200 ring-1 ring-white/10">
                          {candidates.length} {candidates.length === 1 ? 'Talent' : 'Talente'}
                        </span>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-left">
                        <thead className="border-b border-slate-100 bg-slate-50/90">
                          <tr>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Name</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Exp</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Live</th>
                            <th className="min-w-[150px] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              Team
                              <span className="mt-0.5 block font-bold normal-case tracking-normal text-[9px] text-slate-400/90">Wer bearbeitet?</span>
                            </th>
                            <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {candidates.map((cand) => (
                            <tr key={cand.userId} className="transition-colors hover:bg-slate-50/80">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  <Avatar seed={cand.firstName + cand.lastName} size="sm" imageUrl={cand.profileImageUrl} />
                                  <div>
                                    <div className="text-sm font-bold text-slate-900">
                                      {cand.firstName} {cand.lastName}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase text-slate-400">{cand.city}</div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-xs font-semibold text-slate-600">{cand.experienceYears}J</td>
                              <td className="px-5 py-3">
                                <Badge variant={cand.status === CandidateStatus.ACTIVE ? 'green' : cand.status === CandidateStatus.BLOCKED ? 'red' : 'yellow'}>
                                  {cand.status === CandidateStatus.ACTIVE
                                    ? cand.status
                                    : cand.status === CandidateStatus.BLOCKED
                                      ? cand.status
                                      : cand.isSubmitted
                                        ? 'Eingereicht'
                                        : 'Entwurf'}
                                </Badge>
                                {cand.isSubmitted && (
                                  <div
                                    className={`mt-1 text-[10px] font-black uppercase tracking-widest ${cand.cvReviewedAt ? 'text-emerald-600' : 'text-orange-600'}`}
                                  >
                                    {cand.cvReviewedAt ? 'CV geprüft' : 'CV offen'}
                                  </div>
                                )}
                              </td>
                              <td className="px-5 py-3">
                                <Badge variant={cand.isPublished ? 'green' : 'slate'}>{cand.isPublished ? 'Ja' : 'Nein'}</Badge>
                              </td>
                              <td className="align-top px-5 py-3">
                                {(() => {
                                  const editing = getActiveRecruiterEditing(cand);
                                  const busy = claimBusyUserId === cand.userId;
                                  if (editing) {
                                    const mine = editing.userId === user.id;
                                    return (
                                      <div className="flex flex-col items-start gap-1.5">
                                        <span
                                          className={`max-w-[11rem] text-[10px] font-black uppercase leading-tight tracking-wide ${mine ? 'text-emerald-700' : 'text-amber-800'}`}
                                          title={
                                            mine
                                              ? 'Andere Recruiter sehen: Sie sind für diesen Kandidaten eingetragen.'
                                              : `${editing.label} hat geklickt: Kollegen sollen nicht parallel bearbeiten.`
                                          }
                                        >
                                          {mine ? 'Sie bearbeiten (sichtbar)' : `${editing.label} bearbeitet`}
                                        </span>
                                        <Button
                                          size="sm"
                                          variant={mine ? 'outline' : 'secondary'}
                                          className="h-7 rounded-lg px-2 text-[10px] font-black"
                                          disabled={busy}
                                          onClick={() => void handleRecruiterEditingClaim(cand)}
                                        >
                                          {mine ? 'Fertig – freigeben' : 'Ich übernehme'}
                                        </Button>
                                      </div>
                                    );
                                  }
                                  return (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 rounded-lg border-amber-200 px-2 text-[10px] font-black text-amber-900 hover:bg-amber-50"
                                      disabled={busy}
                                      title="Klicken = für alle Recruiter sichtbar: Sie bearbeiten diesen Kandidaten. Bleibt aktiv, bis Sie „Fertig – freigeben“ wählen."
                                      onClick={() => void handleRecruiterEditingClaim(cand)}
                                    >
                                      Ich bearbeite
                                    </Button>
                                  );
                                })()}
                              </td>
                              <td className="px-5 py-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  {!cand.isPublished && (!!cand.isSubmitted || cand.status === CandidateStatus.ACTIVE) && (
                                    <Button
                                      size="sm"
                                      variant="primary"
                                      className="h-8 rounded-xl px-3 text-[11px] font-black"
                                      onClick={() => onAdminAction(cand.userId, 'publish', undefined, user.id)}
                                      disabled={!cand.cvReviewedAt}
                                    >
                                      FREIGEBEN
                                    </Button>
                                  )}
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-8 px-3 text-xs font-black text-orange-600"
                                    onClick={() => handleViewCandidate(cand)}
                                  >
                                    MANAGE
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              {auditLogs.length === 0 ? <div className="p-8 text-center text-xs font-bold text-slate-400">Leer.</div> : (
                <div className="divide-y divide-slate-50">
                  {auditLogs.map(log => (
                    <div key={log.id} className="px-6 py-4 flex items-center justify-between hover:bg-slate-50">
                      <div><p className="text-sm font-bold text-slate-900">{log.action}</p><p className="text-[10px] text-slate-400 mt-0.5">{log.performerId} &rarr; {log.targetId}</p></div>
                      <div className="text-[10px] font-bold text-slate-400">{formatDate(log.timestamp)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal */}
        {selectedCandidate && (
          <Modal isOpen={!!selectedCandidate} onClose={() => { setSelectedCandidate(null); setIsEditing(false); }} title={isEditing ? "Bearbeiten" : "Details"}>
            <div className="space-y-4">
              {claimError && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold text-red-800">
                  {claimError}
                </div>
              )}
              {(() => {
                const e = getActiveRecruiterEditing(selectedCandidate);
                const busy = claimBusyUserId === selectedCandidate.userId;
                if (!e) {
                  return (
                    <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-xs font-bold text-slate-700">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Kollision vermeiden</p>
                        <p className="mt-1 leading-snug">
                          Klicken Sie unten, wenn <strong>Sie</strong> diesen Kandidaten bearbeiten.{' '}
                          <strong>Alle anderen Recruiter sehen das</strong> – so bearbeitet nicht jemand parallel und es gibt weniger Fehler.
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="primary"
                        className="h-9 shrink-0 text-[10px] font-black"
                        disabled={busy}
                        onClick={() => void handleRecruiterEditingClaim(selectedCandidate)}
                      >
                        Ich bearbeite diesen Kandidaten
                      </Button>
                    </div>
                  );
                }
                const mine = e.userId === user.id;
                return (
                  <div
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${mine ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-amber-200 bg-amber-50 text-amber-950'}`}
                  >
                    <span>
                      {mine
                        ? 'Sie sind für andere als Bearbeiter eingetragen. Der Status bleibt, bis Sie „Fertig – freigeben“ wählen (auch nach Schließen dieses Fensters).'
                        : `${e.label} bearbeitet diesen Kandidaten (Team-Sicht). Bitte nicht parallel am gleichen Profil arbeiten – oder „Ich übernehme“ nach Absprache.`}
                    </span>
                    <Button
                      size="sm"
                      variant={mine ? 'outline' : 'secondary'}
                      className="h-8 text-[10px] font-black shrink-0"
                      disabled={busy}
                      onClick={() => void handleRecruiterEditingClaim(selectedCandidate)}
                    >
                      {mine ? 'Fertig – freigeben' : 'Ich übernehme'}
                    </Button>
                  </div>
                );
              })()}
              {/* Header */}
              <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-2xl text-white">
                <Avatar seed={selectedCandidate.firstName} size="md" imageUrl={selectedCandidate.profileImageUrl} />
                <div className="flex-1 leading-tight">
                  <h3 className="text-lg font-black">{selectedCandidate.firstName} {selectedCandidate.lastName}</h3>
                  <p className="text-orange-500 font-bold uppercase text-[10px] tracking-wider">{selectedCandidate.industry}</p>
                </div>
                {!isEditing && canShowPublishFor(selectedCandidate) && (
                  <Button
                    variant="primary"
                    className="px-4 py-2 text-xs h-auto rounded-xl"
                    onClick={() => handlePublish(selectedCandidate)}
                    disabled={!!publishDisabledReason(selectedCandidate)}
                    title={publishDisabledReason(selectedCandidate) || undefined}
                  >
                    FREIGEBEN
                  </Button>
                )}
                {canEdit && !isEditing && <Button variant="secondary" className="px-4 py-2 text-xs h-auto" onClick={() => setIsEditing(true)}>BEARBEITEN</Button>}
              </div>

              {/* Tabs */}
              {isEditing ? (
                <Tabs
                  tabs={[
                    { id: 'general', label: 'Stammdaten' },
                    { id: 'skills', label: 'Skills' },
                    { id: 'social', label: 'Links' }
                  ]}
                  activeTab={editTab}
                  onChange={setEditTab}
                />
              ) : (
                <Tabs
                  tabs={isAdmin
                    ? [{ id: 'profile', label: 'Profil' }, { id: 'documents', label: 'Dokumente' }, { id: 'admin', label: 'Admin' }]
                    : [{ id: 'profile', label: 'Profil' }, { id: 'documents', label: 'Dokumente' }]
                  }
                  activeTab={modalTab}
                  onChange={setModalTab}
                />
              )}

              {/* EDIT FORM (Buffered) */}
              {isEditing && editForm && (
                <div className="max-h-[50vh] overflow-y-auto pr-2 space-y-4">
                  {editTab === 'general' && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3"><Input label="Vorname" name="firstName" value={editForm.firstName} onChange={handleEditChange} className="h-10 text-sm" /><Input label="Nachname" name="lastName" value={editForm.lastName} onChange={handleEditChange} className="h-10 text-sm" /></div>
                      <div className="grid grid-cols-2 gap-3"><Input label="Stadt" name="city" value={editForm.city} onChange={handleEditChange} className="h-10 text-sm" /><Input label="Land" name="country" value={editForm.country} onChange={handleEditChange} className="h-10 text-sm" /></div>
                      <div className="grid grid-cols-2 gap-3">
                        <Select label="Branche" name="industry" value={editForm.industry} onChange={handleEditChange} className="h-10 text-sm">{INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}</Select>
                        <Input label="Erfahrung" type="number" name="experienceYears" value={editForm.experienceYears} onChange={handleEditNumberChange} className="h-10 text-sm" />
                      </div>
                      <Select label="Verfügbarkeit" name="availability" value={editForm.availability} onChange={handleEditChange} className="h-10 text-sm">{AVAILABILITY_OPTIONS.map(a => <option key={a} value={a}>{a}</option>)}</Select>
                      <Textarea label="Über" name="about" value={editForm.about || ''} onChange={handleEditChange} className="text-sm" />

                      {/* Admin-only: Status & Sichtbarkeit */}
                      {isAdmin && (
                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-3 mt-2">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status & Sichtbarkeit</p>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <input type="checkbox" className="w-4 h-4 rounded border-slate-300 text-orange-600 focus:ring-orange-500" checked={editForm.isPublished} onChange={e => setEditForm({ ...editForm, isPublished: e.target.checked })} />
                              <span className="text-sm font-bold text-slate-700">Live veröffentlicht</span>
                            </label>
                            <div className="h-4 w-px bg-slate-300"></div>
                            <Select name="status" value={editForm.status} onChange={handleEditChange} className="!mt-0 w-40 h-9 text-xs py-0 ring-0 border-slate-200">
                              {Object.values(CandidateStatus).map(s => <option key={s} value={s}>{s}</option>)}
                            </Select>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {editTab === 'skills' && (
                    <div>
                      <div className="flex flex-wrap gap-2 mb-4">{editForm.skills.map(s => <span key={s} className="bg-slate-100 px-2 py-1 rounded text-xs font-bold flex gap-2 items-center">{s}<button onClick={() => removeSkill(s)} className="text-red-400 hover:text-red-600">×</button></span>)}</div>
                      <div className="flex gap-2"><Input value={newSkill} onChange={e => setNewSkill(e.target.value)} placeholder="Skill..." className="h-10 text-sm" /><Button size="sm" onClick={addSkill}>+</Button></div>
                    </div>
                  )}
                  {editTab === 'social' && (
                    <div className="space-y-3">
                      {editForm.socialLinks.map((l, i) => <div key={i} className="flex justify-between bg-slate-50 p-2 rounded items-center"><span className="text-xs truncate max-w-[150px] font-bold">{l.label}</span><button onClick={() => removeLink(i)} className="text-red-500 text-[10px] font-black uppercase">Löschen</button></div>)}
                      <div className="grid grid-cols-2 gap-2"><Input placeholder="Label" value={newLink.label} onChange={e => setNewLink({ ...newLink, label: e.target.value })} className="h-9 text-xs" /><Input placeholder="URL" value={newLink.url} onChange={e => setNewLink({ ...newLink, url: e.target.value })} className="h-9 text-xs" /></div>
                      <Button size="sm" className="w-full" onClick={addLink} disabled={!newLink.label}>Link hinzufügen</Button>
                    </div>
                  )}

                  <div className="pt-4 mt-2 border-t border-slate-100 flex gap-3 sticky bottom-0 bg-white pb-1">
                    <Button variant="outline" className="flex-1 h-10 text-sm" onClick={() => setIsEditing(false)}>Abbrechen</Button>
                    <Button variant="primary" className="flex-1 h-10 text-sm" onClick={handleSaveEdit}>SPEICHERN</Button>
                  </div>
                </div>
              )}

              {/* READ ONLY MODE */}
              {!isEditing && (
                <>
                  {modalTab === 'profile' && (
                    <div className="space-y-3">
                      {canShowPublishFor(selectedCandidate) && (
                        <div className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm">
                          <Button
                            variant="primary"
                            className="w-full h-11 rounded-xl text-sm font-black"
                            onClick={() => handlePublish(selectedCandidate)}
                            disabled={!!publishDisabledReason(selectedCandidate)}
                            title={publishDisabledReason(selectedCandidate) || undefined}
                          >
                            Kandidat freigeben (im Marktplatz sichtbar)
                          </Button>
                          {publishDisabledReason(selectedCandidate) && (
                            <div className="mt-2 text-[11px] font-bold text-orange-700">
                              {publishDisabledReason(selectedCandidate)}
                            </div>
                          )}
                          {!publishDisabledReason(selectedCandidate) && selectedCandidate && !selectedCandidate.cvReviewedAt && (
                            <div className="mt-2 text-[11px] font-bold text-slate-600">
                              Hinweis: Beim Klick wird der CV automatisch als „geprüft“ markiert.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Kontakt/Adresse (für Recruiter sichtbar, aber read-only) */}
                      <div className="bg-white p-4 rounded-xl border-2 border-slate-100 mb-4 shadow-sm">
                        <div className="flex items-center gap-2 mb-3">
                          <Badge variant="slate" className="text-[10px] py-0.5 px-2 bg-slate-100 text-slate-700">KONTAKT</Badge>
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nur anzeigen</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Name</p>
                            <p className="font-black text-slate-900 text-sm">{selectedCandidate.firstName} {selectedCandidate.lastName}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Adresse</p>
                            <p className="font-medium text-slate-700 text-sm">
                              {selectedCandidate.address || '-'} {selectedCandidate.zipCode || ''}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Telefon</p>
                            <p className="font-medium text-slate-700 text-sm">{selectedCandidate.phoneNumber || '-'}</p>
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">System-ID</p>
                            <p className="font-mono text-xs text-slate-400 truncate">{selectedCandidate.userId}</p>
                          </div>
                        </div>
                      </div>

                      {/* Legacy: alte Admin-Box entfernt */}
                      {false && isAdmin && (
                        <div className="bg-white p-4 rounded-xl border-2 border-slate-100 mb-4 shadow-sm">
                          <div className="flex items-center gap-2 mb-3">
                            <Badge variant="dark" className="text-[10px] py-0.5 px-2 bg-slate-800 text-white">ADMIN DATA</Badge>
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Vertraulich</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Name</p>
                              <p className="font-black text-slate-900 text-sm">{selectedCandidate.firstName} {selectedCandidate.lastName}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Adresse</p>
                              <p className="font-medium text-slate-700 text-sm">{selectedCandidate.address || '-'} {selectedCandidate.zipCode}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Kontakt</p>
                              <p className="font-medium text-slate-700 text-sm">{selectedCandidate.phoneNumber || '-'}</p>
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">System-ID</p>
                              <p className="font-mono text-xs text-slate-400 truncate">{selectedCandidate.userId}</p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Ort</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCandidate.city || '-'}, {selectedCandidate.country || '-'}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Branche</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCandidate.industry || '-'}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Verfügbarkeit</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCandidate.availability || '-'}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Erfahrung</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCandidate.experienceYears} Jahre</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Status</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCandidate.status}</p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Live</p>
                          <p className="text-sm font-bold text-slate-900">{selectedCandidate.isPublished ? 'Ja' : 'Nein'}</p>
                        </div>
                      </div>

                      {selectedCandidate.about && <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Über</p><p className="text-sm text-slate-700 leading-relaxed">{selectedCandidate.about}</p></div>}
                      {selectedCandidate.skills.length > 0 && <div className="flex flex-wrap gap-1">{selectedCandidate.skills.map(s => <Badge key={s} variant="orange">{s}</Badge>)}</div>}

                      {selectedCandidate.socialLinks?.length > 0 && (
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Links</p>
                          <div className="space-y-2">
                            {selectedCandidate.socialLinks.map((l, idx) => (
                              <div key={idx} className="flex items-center justify-between gap-3">
                                <span className="text-xs font-black text-slate-700">{l.label}</span>
                                <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-orange-700 hover:underline truncate max-w-[320px]">
                                  {l.url}
                                </a>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* --- DOCUMENTS TAB (With Preview Modal) --- */}
                  {modalTab === 'documents' && (
                    <div className="space-y-4">
                      {/* CV */}
                      <div>
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Lebenslauf</h4>
                        {candidateDocs?.cvPdf ? (
                          <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                            <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{candidateDocs.cvPdf.name}</span>
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  if (selectedCandidate?.userId && !selectedCandidate.cvReviewedAt) {
                                    onAdminAction(selectedCandidate.userId, 'cv_reviewed', undefined, user.id);
                                  }
                                  setPreviewDoc(candidateDocs.cvPdf!);
                                }}
                                className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700"
                              >
                                Ansehen
                              </button>
                              <a href={candidateDocs.cvPdf.data} download={candidateDocs.cvPdf.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">↓</a>
                              <button
                                onClick={handleRemoveCv}
                                disabled={isSavingDocs}
                                className="px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-black text-red-700 disabled:opacity-60"
                              >
                                Entfernen
                              </button>
                              <label className={`px-3 py-1 rounded-lg text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                                Ersetzen
                                <input
                                  type="file"
                                  accept="application/pdf"
                                  className="hidden"
                                  disabled={isSavingDocs}
                                  onChange={(e) => handleReplaceCv(e.target.files)}
                                />
                              </label>
                            </div>
                          </div>
                        ) : <div className="text-xs text-slate-400 italic">Kein CV</div>}
                        {!candidateDocs?.cvPdf && (
                          <div className="mt-2">
                            <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                              CV hochladen
                              <input
                                type="file"
                                accept="application/pdf"
                                className="hidden"
                                disabled={isSavingDocs}
                                onChange={(e) => handleReplaceCv(e.target.files)}
                              />
                            </label>
                          </div>
                        )}
                        {selectedCandidate?.isSubmitted && (
                          <div className="mt-2 text-[11px] font-bold text-slate-600">
                            {selectedCandidate.cvReviewedAt ? (
                              <span className="text-emerald-700">Freigabe möglich (CV geprüft).</span>
                            ) : (
                              <span className="text-orange-700">Vor Freigabe bitte CV ansehen (wird automatisch als geprüft markiert).</span>
                            )}
                          </div>
                        )}
                        {docError && <div className="mt-2 text-[11px] font-black text-red-600">{docError}</div>}
                      </div>

                      {/* Certificates */}
                      <div>
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Zertifikate</h4>
                        <div className="space-y-2">
                          {candidateDocs?.certificates?.length ? candidateDocs.certificates.map((doc, i) => (
                            <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                              <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{doc.name}</span>
                              <div className="flex gap-2">
                                <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">Ansehen</button>
                                <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">↓</a>
                                <button
                                  onClick={() => handleRemoveCertificate(i)}
                                  disabled={isSavingDocs}
                                  className="px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-black text-red-700 disabled:opacity-60"
                                >
                                  Entfernen
                                </button>
                                <label className={`px-3 py-1 rounded-lg text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                                  Ersetzen
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    disabled={isSavingDocs}
                                    onChange={(e) => handleReplaceCertificate(i, e.target.files)}
                                  />
                                </label>
                              </div>
                            </div>
                          )) : <div className="text-xs text-slate-400 italic">Keine</div>}
                        </div>
                        <div className="mt-2">
                          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                            Zertifikate hinzufügen
                            <input
                              type="file"
                              accept="application/pdf"
                              multiple
                              className="hidden"
                              disabled={isSavingDocs}
                              onChange={(e) => handleAddCertificates(e.target.files)}
                            />
                          </label>
                        </div>
                      </div>

                      {/* Qualifications */}
                      <div>
                        <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Qualifikationen</h4>
                        <div className="space-y-2">
                          {candidateDocs?.qualifications?.length ? candidateDocs.qualifications.map((doc, i) => (
                            <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50 hover:bg-white hover:shadow-md transition-all">
                              <span className="text-sm font-bold text-slate-700 truncate max-w-[200px]">{doc.name}</span>
                              <div className="flex gap-2">
                                <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">Ansehen</button>
                                <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">↓</a>
                                <button
                                  onClick={() => handleRemoveQualification(i)}
                                  disabled={isSavingDocs}
                                  className="px-3 py-1 bg-red-50 hover:bg-red-100 rounded-lg text-xs font-black text-red-700 disabled:opacity-60"
                                >
                                  Entfernen
                                </button>
                                <label className={`px-3 py-1 rounded-lg text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                                  Ersetzen
                                  <input
                                    type="file"
                                    accept="application/pdf"
                                    className="hidden"
                                    disabled={isSavingDocs}
                                    onChange={(e) => handleReplaceQualification(i, e.target.files)}
                                  />
                                </label>
                              </div>
                            </div>
                          )) : <div className="text-xs text-slate-400 italic">Keine</div>}
                        </div>
                        <div className="mt-2">
                          <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                            Qualifikationen hinzufügen
                            <input
                              type="file"
                              accept="application/pdf"
                              multiple
                              className="hidden"
                              disabled={isSavingDocs}
                              onChange={(e) => handleAddQualifications(e.target.files)}
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {isAdmin && modalTab === 'admin' && (
                    <div className="space-y-6">
                      {/* SAFETY: Removed instant buttons. Only Link to Edit Mode */}
                      <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                        <p className="text-xs font-bold text-blue-800 mb-2">Status & Daten ändern?</p>
                        <Button variant="secondary" className="w-full text-xs" onClick={() => setIsEditing(true)}>In den Bearbeitungsmodus wechseln</Button>
                      </div>

                      {/* DANGER ZONE (Still here, but with confirmation in handler) */}
                      {isAdmin && <div className="pt-4 border-t border-slate-100"><p className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3">Gefahrenzone</p><Button variant="danger" className="w-full" onClick={handleDelete}>Kandidat Löschen</Button></div>}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* FOOTER */}
            {!isEditing && <div className="pt-4 border-t border-slate-100 mt-4"><Button className="w-full" variant="outline" onClick={() => setSelectedCandidate(null)}>Schließen</Button></div>}
          </Modal>
        )}

        {/* --- FULLSCREEN DOCUMENT PREVIEW MODAL --- */}
        {previewDoc && (
          <div className="fixed inset-0 z-[60] bg-slate-900/90 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200" onClick={() => setPreviewDoc(null)}>
            <div className="bg-white w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
              <div className="h-14 border-b border-slate-100 flex items-center justify-between px-6 bg-slate-50">
                <h3 className="font-bold text-slate-700 truncate">{previewDoc.name}</h3>
                <div className="flex gap-4">
                  <a href={previewDoc.data} download={previewDoc.name} className="text-xs font-black text-orange-600 hover:underline">HERUNTERLADEN</a>
                  <button onClick={() => setPreviewDoc(null)} className="text-xs font-black text-slate-400 hover:text-slate-600">SCHLIESSEN</button>
                </div>
              </div>
              <div className="flex-1 bg-slate-200 p-4">
                <iframe src={previewDoc.data} className="w-full h-full rounded-xl bg-white shadow-sm" title="Preview" />
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
};

export default RecruiterDashboard;
