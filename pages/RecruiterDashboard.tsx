
import React, { useState, useEffect } from 'react';
import { User, UserRole, CandidateProfile, CandidateStatus, CandidateDocuments, AuditLog } from '../types';
import { Button, Avatar, Badge, Modal, Tabs, EmptyState, Input, Select, Textarea } from '../components/UI';
import { candidateService } from '../services/CandidateService';
import { auditService } from '../services/AuditService';
import { INDUSTRIES, AVAILABILITY_OPTIONS } from '../constants';

interface RecruiterDashboardProps {
  user: User;
  candidates: CandidateProfile[];
  onAdminAction: (userUuid: string, action: 'delete' | 'status', newStatus?: CandidateStatus, performerId?: string) => void;
  onUpdateCandidate?: (candidate: CandidateProfile) => void;
  onLogout: () => void;
}

const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ user, candidates, onAdminAction, onUpdateCandidate, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<CandidateDocuments | null>(null);
  const [activeTab, setActiveTab] = useState('candidates');
  const [modalTab, setModalTab] = useState('profile');
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [isLoadingAudit, setIsLoadingAudit] = useState(false);

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

  const loadAuditLogs = async () => {
    setIsLoadingAudit(true);
    try {
      const logs = await auditService.getAll();
      setAuditLogs(logs);
    } catch (e) { console.error(e); } finally { setIsLoadingAudit(false); }
  };

  const filtered = candidates.filter(c =>
    `${c.firstName} ${c.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.industry.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.skills.some(s => s.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const isAdmin = user.role === UserRole.ADMIN;

  const handleViewCandidate = async (candidate: CandidateProfile) => {
    setSelectedCandidate(candidate);
    setEditForm(JSON.parse(JSON.stringify(candidate)));
    setIsEditing(false);
    setModalTab('profile');
    const docs = await candidateService.getDocuments(candidate.userId);
    setCandidateDocs(docs || null);
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
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center font-black italic shadow-lg text-sm">CT</div>
            <img src="/cms-talents-logo.png" alt="CMS Talents" className="h-8 w-auto object-contain" />
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
          {activeTab === 'candidates' ? (
            filtered.length === 0 ? <EmptyState title="Keine Kandidaten" description="Nichts gefunden." /> : (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Name</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Branche</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Exp</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest">Live</th>
                      <th className="px-6 py-3 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {filtered.map(cand => (
                      <tr key={cand.userId} className="hover:bg-slate-50 transition-colors">
                        <td className="px-6 py-3 flex items-center gap-3">
                          <Avatar seed={cand.firstName + cand.lastName} size="sm" imageUrl={cand.profileImageUrl} />
                          <div><div className="text-sm font-bold text-slate-900">{cand.firstName} {cand.lastName}</div><div className="text-[10px] text-slate-400 font-bold uppercase">{cand.city}</div></div>
                        </td>
                        <td className="px-6 py-3 text-xs font-semibold text-slate-600">{cand.industry || '-'}</td>
                        <td className="px-6 py-3 text-xs font-semibold text-slate-600">{cand.experienceYears}J</td>
                        <td className="px-6 py-3"><Badge variant={cand.status === CandidateStatus.ACTIVE ? 'green' : cand.status === CandidateStatus.BLOCKED ? 'red' : 'yellow'}>{cand.status}</Badge></td>
                        <td className="px-6 py-3"><Badge variant={cand.isPublished ? 'green' : 'slate'}>{cand.isPublished ? 'Ja' : 'Nein'}</Badge></td>
                        <td className="px-6 py-3 text-right"><Button size="sm" variant="ghost" className="text-xs text-orange-600 font-black h-8 px-3" onClick={() => handleViewCandidate(cand)}>MANAGE</Button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
              {/* Header */}
              <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-2xl text-white">
                <Avatar seed={selectedCandidate.firstName} size="md" imageUrl={selectedCandidate.profileImageUrl} />
                <div className="flex-1 leading-tight">
                  <h3 className="text-lg font-black">{selectedCandidate.firstName} {selectedCandidate.lastName}</h3>
                  <p className="text-orange-500 font-bold uppercase text-[10px] tracking-wider">{selectedCandidate.industry}</p>
                </div>
                {isAdmin && !isEditing && <Button variant="secondary" className="px-4 py-2 text-xs h-auto" onClick={() => setIsEditing(true)}>BEARBEITEN</Button>}
              </div>

              {/* Tabs */}
              {isEditing ? (
                <Tabs tabs={[{ id: 'general', label: 'Stammdaten' }, { id: 'skills', label: 'Skills' }, { id: 'social', label: 'Links' }]} activeTab={editTab} onChange={setEditTab} />
              ) : (
                <Tabs tabs={[{ id: 'profile', label: 'Profil' }, { id: 'documents', label: 'Dokumente' }, { id: 'admin', label: 'Admin' }]} activeTab={modalTab} onChange={setModalTab} />
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

                      {/* SAFETY: Status Change ONLY here with Save */}
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
                      {/* PRIVATE DATA SECTION (ADMIN ONLY) */}
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
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-black text-slate-400 uppercase">Erfahrung</p><p className="text-sm font-bold text-slate-900">{selectedCandidate.experienceYears} Jahre</p></div>
                        <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-black text-slate-400 uppercase">Status</p><p className="text-sm font-bold text-slate-900">{selectedCandidate.status}</p></div>
                      </div>
                      {selectedCandidate.about && <div className="bg-slate-50 p-3 rounded-xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Über</p><p className="text-sm text-slate-700 leading-relaxed">{selectedCandidate.about}</p></div>}
                      {selectedCandidate.skills.length > 0 && <div className="flex flex-wrap gap-1">{selectedCandidate.skills.map(s => <Badge key={s} variant="orange">{s}</Badge>)}</div>}
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
                              <button onClick={() => setPreviewDoc(candidateDocs.cvPdf!)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">Ansehen</button>
                              <a href={candidateDocs.cvPdf.data} download={candidateDocs.cvPdf.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">↓</a>
                            </div>
                          </div>
                        ) : <div className="text-xs text-slate-400 italic">Kein CV</div>}
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
                              </div>
                            </div>
                          )) : <div className="text-xs text-slate-400 italic">Keine</div>}
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
                              </div>
                            </div>
                          )) : <div className="text-xs text-slate-400 italic">Keine</div>}
                        </div>
                      </div>
                    </div>
                  )}

                  {modalTab === 'admin' && (
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
