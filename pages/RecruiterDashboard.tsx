
import React, { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef } from 'react';
import { User, UserRole, CandidateProfile, CandidateStatus, CandidateDocuments, CandidateDocumentsForRecruiter, CandidateInquiry, RegisteredUserListItem, RecruiterAvailabilityEvent, RecruiterTeamMessage, getActiveInquiryEditing, getActiveRecruiterEditing } from '../types';
import { CmsLogoHeroBadge } from '../components/CmsLogoHeroBadge';
import { Button, Avatar, Badge, Modal, Tabs, EmptyState, Input, Select, Textarea, FileUpload } from '../components/UI';
import HourlyRateCalculator from '../components/HourlyRateCalculator';
import { candidateService } from '../services/CandidateService';
import { INDUSTRIES, AVAILABILITY_OPTIONS, BOOSTER_KEYWORD_CATEGORIES, WORK_UMKREIS_OPTIONS, parseWorkUmkreisOption } from '../constants';
import { documentService } from '../services/DocumentService';
import { recruiterRoleFromEmail } from '../services/ApiClient';
import { COPPER_PANEL } from '../constants/copperTheme';
import { supabase } from '../utils/supabase';
import { rankCandidates } from '../services/SearchService';

interface RecruiterDashboardProps {
  user: User;
  candidates: CandidateProfile[];
  isInitialLoading?: boolean;
  onAdminAction: (userUuid: string, action: 'delete' | 'status' | 'publish' | 'unpublish' | 'cv_reviewed', newStatus?: CandidateStatus, performerId?: string) => Promise<void> | void;
  onUpdateCandidate?: (candidate: CandidateProfile) => void;
  onRefreshCandidates?: () => Promise<void> | void;
  onLogout: () => void;
}

const STALE_CANDIDATE_MS = 3 * 24 * 60 * 60 * 1000;
const RECRUITER_EDITING_CLAIM_HEARTBEAT_MS = 60 * 60 * 1000; // 1h

/** E-Mail-Allowlist hat Vorrang vor evtl. veralteter DB-Rolle (z. B. Recruiter noch als Kandidat gespeichert). */
function effectiveRegisteredUserRole(u: RegisteredUserListItem): UserRole {
  const fromAllowlist = recruiterRoleFromEmail(u.email);
  return fromAllowlist !== UserRole.CANDIDATE ? fromAllowlist : u.role;
}

function membershipDurationDe(createdAt: string): string {
  const ms = Date.now() - new Date(createdAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 60000) return 'weniger als 1 Minute';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `${minutes} Minute${minutes === 1 ? '' : 'n'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} Stunde${hours === 1 ? '' : 'n'}`;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 30) return `${days} Tag${days === 1 ? '' : 'e'}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `${months} Monat${months === 1 ? '' : 'e'}`;
  const years = Math.floor(days / 365);
  return `${years} Jahr${years === 1 ? '' : 'e'}`;
}

function inactivityDurationDe(lastSeenAt?: string | null): string {
  if (!lastSeenAt) return 'Keine Aktivität erfasst';
  const ms = Date.now() - new Date(lastSeenAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '—';
  if (ms < 5 * 60 * 1000) return 'Gerade online';
  if (ms < 60000) return 'Vor weniger als 1 Minute';
  const minutes = Math.floor(ms / 60000);
  if (minutes < 60) return `Vor ${minutes} Minute${minutes === 1 ? '' : 'n'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `Vor ${hours} Stunde${hours === 1 ? '' : 'n'}`;
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days < 30) return `Vor ${days} Tag${days === 1 ? '' : 'en'}`;
  const months = Math.floor(days / 30);
  if (months < 24) return `Vor ${months} Monat${months === 1 ? '' : 'en'}`;
  const years = Math.floor(days / 365);
  return `Vor ${years} Jahr${years === 1 ? '' : 'en'}`;
}

function roleLabelDe(role: UserRole): string {
  if (role === UserRole.ADMIN) return 'Recruiter';
  if (role === UserRole.RECRUITER) return 'Recruiter';
  return 'Kandidat';
}

function contactInitialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0] ?? '';
    const b = parts[parts.length - 1][0] ?? '';
    return `${a}${b}`.toUpperCase();
  }
  return (parts[0]?.slice(0, 2) || '?').toUpperCase();
}

/** Erkennt die strukturierte Marktplatz-Anfrage (TalentMarketplace.submitInquiry), ein- oder mehrzeilig. */
const MARKETPLACE_INQUIRY_FIELDS: { prefix: string; label: string }[] = [
  { prefix: 'Firma:', label: 'Firma' },
  { prefix: 'Vorname:', label: 'Vorname' },
  { prefix: 'Nachname:', label: 'Nachname' },
  { prefix: 'E-Mail:', label: 'E-Mail' },
  { prefix: 'Telefon:', label: 'Telefon' },
  { prefix: 'Suchprofil:', label: 'Suchprofil' },
  { prefix: 'Position (Kunde):', label: 'Position (Kunde)' },
  { prefix: 'Projektlaufzeit:', label: 'Projektlaufzeit' },
  { prefix: 'Projektstandort:', label: 'Projektstandort' },
  { prefix: 'Budget (EUR):', label: 'Budget (EUR)' },
];

const PLANNER_WEEKDAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function toLocalDateKey(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseMarketplaceInquiryDetails(message: string | undefined): { label: string; value: string }[] | null {
  if (!message?.trim()) return null;
  const text = message.trim();

  const suchSplit = text.split(/\n\nSuchprofil:\n/);
  if (suchSplit.length === 2) {
    const head = suchSplit[0].trim();
    const suchBody = suchSplit[1].trim();
    const headRows = parseMarketplaceInquiryDetails(head);
    const base = headRows && headRows.length > 0 ? [...headRows] : [];
    if (headRows == null && head) {
      for (const line of head.split('\n').map((l) => l.trim()).filter(Boolean)) {
        const hit = [...MARKETPLACE_INQUIRY_FIELDS].sort((a, b) => b.prefix.length - a.prefix.length).find((f) => line.startsWith(f.prefix));
        if (hit) base.push({ label: hit.label, value: line.slice(hit.prefix.length).trim() });
      }
    }
    if (suchBody) base.push({ label: 'Suchprofil', value: suchBody });
    return base.length > 0 ? base : null;
  }

  const hits = MARKETPLACE_INQUIRY_FIELDS.map(({ prefix, label }) => {
    const index = text.indexOf(prefix);
    return index >= 0 ? { prefix, label, index } : null;
  }).filter((x): x is { prefix: string; label: string; index: number } => x !== null);

  if (hits.length >= 2) {
    hits.sort((a, b) => a.index - b.index);
    const rows: { label: string; value: string }[] = [];
    for (let i = 0; i < hits.length; i++) {
      const start = hits[i].index + hits[i].prefix.length;
      const end = i + 1 < hits.length ? hits[i + 1].index : text.length;
      rows.push({ label: hits[i].label, value: text.slice(start, end).trim() });
    }
    return rows;
  }

  const lines = text.split(/\n/).map((l) => l.trim()).filter(Boolean);
  const byLongestPrefix = [...MARKETPLACE_INQUIRY_FIELDS].sort((a, b) => b.prefix.length - a.prefix.length);
  const fromLines: { label: string; value: string }[] = [];
  for (const line of lines) {
    const hit = byLongestPrefix.find((f) => line.startsWith(f.prefix));
    if (hit) fromLines.push({ label: hit.label, value: line.slice(hit.prefix.length).trim() });
  }
  return fromLines.length >= 2 ? fromLines : null;
}

/** Rotes Ausrufezeichen im Kreis – gleiche Logik wie „Bearbeiten nötig: seit 3+ Tagen offen“ (nicht bei freigegeben + aktiv). */
function StaleNeedsAttentionIcon({ title }: { title: string }) {
  return (
    <span
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-red-600 bg-red-50 text-red-600 shadow-sm"
      title={title}
      aria-label={title}
      role="img"
    >
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    </span>
  );
}

const RecruiterDashboard: React.FC<RecruiterDashboardProps> = ({ user, candidates, isInitialLoading = false, onAdminAction, onUpdateCandidate, onRefreshCandidates, onLogout }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyStaleUnedited, setOnlyStaleUnedited] = useState(false);
  const [activeView, setActiveView] = useState<
    'talents' | 'inquiries' | 'planner' | 'external' | 'users' | 'calculator' | 'matching'
  >('talents');
  const [matchingRoleBrief, setMatchingRoleBrief] = useState('');
  const [matchingQuery, setMatchingQuery] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<CandidateProfile | null>(null);
  const [candidateDocs, setCandidateDocs] = useState<CandidateDocumentsForRecruiter | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [modalTab, setModalTab] = useState('profile');
  const [isSavingDocs, setIsSavingDocs] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);
  const [claimBusyUserId, setClaimBusyUserId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [deletingInquiryId, setDeletingInquiryId] = useState<string | null>(null);
  const [inquiryClaimBusyId, setInquiryClaimBusyId] = useState<string | null>(null);
  const [inquiryDeleteError, setInquiryDeleteError] = useState<string | null>(null);
  const [inquiryClaimError, setInquiryClaimError] = useState<string | null>(null);
  const [inquiryDeleteTarget, setInquiryDeleteTarget] = useState<CandidateInquiry | null>(null);
  const [inquiryDeleteConfirmText, setInquiryDeleteConfirmText] = useState('');
  const [recruiterEditingHeartbeatCandidateId, setRecruiterEditingHeartbeatCandidateId] = useState<string | null>(null);
  const [inquiries, setInquiries] = useState<CandidateInquiry[]>([]);
  const [isLoadingInquiries, setIsLoadingInquiries] = useState(false);
  const [registeredUsers, setRegisteredUsers] = useState<RegisteredUserListItem[]>([]);
  const [loadingRegisteredUsers, setLoadingRegisteredUsers] = useState(false);
  const [registeredUsersError, setRegisteredUsersError] = useState<string | null>(null);
  const [registeredUsersSuccess, setRegisteredUsersSuccess] = useState<string | null>(null);
  const [userDeleteTarget, setUserDeleteTarget] = useState<RegisteredUserListItem | null>(null);
  const [userDeleteConfirmText, setUserDeleteConfirmText] = useState('');
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [unpublishingUserId, setUnpublishingUserId] = useState<string | null>(null);
  const [isCreatingExternal, setIsCreatingExternal] = useState(false);
  const [externalError, setExternalError] = useState<string | null>(null);
  const [externalSuccess, setExternalSuccess] = useState<string | null>(null);
  const [externalForm, setExternalForm] = useState({
    firstName: '',
    lastName: '',
    city: '',
    country: 'Deutschland',
    industry: INDUSTRIES[0] || '',
    profession: '',
    experienceYears: '',
    availability: AVAILABILITY_OPTIONS[0] || '',
    workUmkreis: WORK_UMKREIS_OPTIONS[0] || '+25',
    salaryWishEur: '',
    about: '',
    languagesRaw: '',
    skillsRaw: '',
  });
  const [externalBoostedKeywords, setExternalBoostedKeywords] = useState<string[]>([]);
  const [externalDocs, setExternalDocs] = useState<CandidateDocuments>({
    userId: 'external:new',
    certificates: [],
    qualifications: [],
  });

  // Document Preview State
  const [previewDoc, setPreviewDoc] = useState<{ name: string; data: string } | null>(null);

  // Edit Mode State
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<CandidateProfile | null>(null);
  const [editTab, setEditTab] = useState('general');

  // Input States
  const [newSkill, setNewSkill] = useState('');
  const [newLink, setNewLink] = useState({ label: '', url: '' });
  const [plannerEvents, setPlannerEvents] = useState<RecruiterAvailabilityEvent[]>([]);
  const [plannerMessages, setPlannerMessages] = useState<RecruiterTeamMessage[]>([]);
  const [plannerLoading, setPlannerLoading] = useState(false);
  const [plannerError, setPlannerError] = useState<string | null>(null);
  const [plannerEventBusyId, setPlannerEventBusyId] = useState<string | null>(null);
  const [plannerEventForm, setPlannerEventForm] = useState({
    title: '',
    scheduledDate: '',
    scheduledTime: '09:00',
    note: '',
  });
  const [plannerMessageDraft, setPlannerMessageDraft] = useState('');
  const [plannerMessageSending, setPlannerMessageSending] = useState(false);
  const [plannerCurrentMonth, setPlannerCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [plannerSelectedDate, setPlannerSelectedDate] = useState(() => toLocalDateKey(new Date()));
  const plannerChatScrollRef = useRef<HTMLDivElement>(null);
  const plannerResumeRefreshAt = useRef(0);

  useEffect(() => {
    if (!selectedCandidate) return;
    const fresh = candidates.find((c) => c.userId === selectedCandidate.userId);
    if (fresh) setSelectedCandidate(fresh);
  }, [candidates, selectedCandidate]);

  // Heartbeat deaktivieren, wenn das Modal / die Auswahl gewechselt oder geschlossen wird.
  useEffect(() => {
    if (!selectedCandidate) {
      setRecruiterEditingHeartbeatCandidateId(null);
      return;
    }
    if (
      recruiterEditingHeartbeatCandidateId &&
      recruiterEditingHeartbeatCandidateId !== selectedCandidate.userId
    ) {
      setRecruiterEditingHeartbeatCandidateId(null);
    }
  }, [selectedCandidate, recruiterEditingHeartbeatCandidateId]);

  // Andere Recruiter sehen Meldungen nach kurzer Zeit automatisch aktualisiert
  useEffect(() => {
    if (!onRefreshCandidates) return;
    const id = window.setInterval(() => {
      void onRefreshCandidates();
    }, 35000);
    return () => window.clearInterval(id);
  }, [onRefreshCandidates]);

  const loadInquiries = useCallback(async () => {
    setIsLoadingInquiries(true);
    try {
      const list = await candidateService.getInquiries();
      setInquiries(list);
    } finally {
      setIsLoadingInquiries(false);
    }
  }, []);

  /** Nach Auth-Hydration / Token-Refresh erneut laden (mobil: erster Fetch oft vor gültigem JWT). */
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') &&
        session
      ) {
        void loadInquiries();
      }
    });
    return () => subscription.unsubscribe();
  }, [loadInquiries]);

  /** Externe Interessen: schneller Poll in dieser Ansicht + Reload bei Tab-/App-Rückkehr (Handy/Tablet/Desktop). */
  useEffect(() => {
    let cancelled = false;
    const safeLoad = async () => {
      setIsLoadingInquiries(true);
      try {
        const list = await candidateService.getInquiries();
        if (!cancelled) setInquiries(list);
      } finally {
        if (!cancelled) setIsLoadingInquiries(false);
      }
    };
    void safeLoad();
    const pollMs = activeView === 'inquiries' ? 10_000 : 30_000;
    const id = window.setInterval(safeLoad, pollMs);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeView]);

  const inquiriesResumeRefreshAt = useRef(0);
  useEffect(() => {
    const refreshIfInquiries = () => {
      if (document.visibilityState !== 'visible') return;
      if (activeView !== 'inquiries') return;
      const now = Date.now();
      if (now - inquiriesResumeRefreshAt.current < 1500) return;
      inquiriesResumeRefreshAt.current = now;
      void loadInquiries();
    };
    document.addEventListener('visibilitychange', refreshIfInquiries);
    window.addEventListener('focus', refreshIfInquiries);
    window.addEventListener('online', refreshIfInquiries);
    return () => {
      document.removeEventListener('visibilitychange', refreshIfInquiries);
      window.removeEventListener('focus', refreshIfInquiries);
      window.removeEventListener('online', refreshIfInquiries);
    };
  }, [activeView, loadInquiries]);

  useEffect(() => {
    if (activeView !== 'users') return;
    let cancelled = false;
    const loadUsers = async () => {
      setLoadingRegisteredUsers(true);
      setRegisteredUsersError(null);
      try {
        const list = await candidateService.listRegisteredUsers();
        if (!cancelled) setRegisteredUsers(list);
      } catch (e) {
        if (!cancelled) {
          setRegisteredUsersError(e instanceof Error ? e.message : 'Nutzer konnten nicht geladen werden.');
        }
      } finally {
        if (!cancelled) setLoadingRegisteredUsers(false);
      }
    };
    void loadUsers();
    const id = window.setInterval(() => {
      void loadUsers();
    }, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeView]);

  const loadPlannerData = useCallback(async () => {
    setPlannerLoading(true);
    setPlannerError(null);
    try {
      const [events, messages] = await Promise.all([
        candidateService.getRecruiterAvailabilityEvents(),
        candidateService.getRecruiterTeamMessages(300),
      ]);
      setPlannerEvents(events);
      setPlannerMessages(messages);
    } catch (e) {
      setPlannerError(e instanceof Error ? e.message : 'Kalender und Chat konnten nicht geladen werden.');
    } finally {
      setPlannerLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeView !== 'planner') return;
    let cancelled = false;
    const poll = async () => {
      try {
        const [events, messages] = await Promise.all([
          candidateService.getRecruiterAvailabilityEvents(),
          candidateService.getRecruiterTeamMessages(300),
        ]);
        if (!cancelled) {
          setPlannerEvents(events);
          setPlannerMessages(messages);
          setPlannerError(null);
        }
      } catch (e) {
        if (!cancelled) setPlannerError(e instanceof Error ? e.message : 'Live-Update fehlgeschlagen.');
      } finally {
        if (!cancelled) setPlannerLoading(false);
      }
    };
    setPlannerLoading(true);
    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, 4000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [activeView]);

  /** Handy: nach Tab-Wechsel / App-Rückkehr Kalender & Chat neu laden (sonst veralteter Stand). */
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      if (activeView !== 'planner') return;
      const now = Date.now();
      if (now - plannerResumeRefreshAt.current < 1500) return;
      plannerResumeRefreshAt.current = now;
      void loadPlannerData();
    };
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [activeView, loadPlannerData]);

  /** Echtzeit: neue Chat-Zeilen von anderen Recruiter-Sessions sofort laden (benötigt Realtime in Supabase). */
  useEffect(() => {
    if (activeView !== 'planner') return;
    const channel = supabase
      .channel('recruiter-team-chat')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'recruiter_chat_messages' },
        () => {
          void loadPlannerData();
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [activeView, loadPlannerData]);

  /** Chat: neueste Nachrichten unten anzeigen (mobil sonst „alter“ Stand sichtbar). */
  useEffect(() => {
    if (activeView !== 'planner') return;
    const el = plannerChatScrollRef.current;
    if (!el) return;
    const run = () => {
      el.scrollTop = el.scrollHeight;
    };
    run();
    const id = window.requestAnimationFrame(run);
    return () => window.cancelAnimationFrame(id);
  }, [activeView, plannerMessages, plannerLoading]);

  const handleCreatePlannerEvent = async () => {
    setPlannerError(null);
    const title = plannerEventForm.title.trim();
    const scheduledDateRaw = plannerEventForm.scheduledDate.trim();
    const scheduledTimeRaw = plannerEventForm.scheduledTime.trim();
    if (!title || !scheduledDateRaw || !scheduledTimeRaw) {
      setPlannerError('Bitte Titel und Terminzeit ausfüllen.');
      return;
    }
    const scheduledForRaw = `${scheduledDateRaw}T${scheduledTimeRaw}`;
    const iso = new Date(scheduledForRaw).toISOString();
    if (!iso || Number.isNaN(new Date(iso).getTime())) {
      setPlannerError('Bitte ein gültiges Datum mit Uhrzeit wählen.');
      return;
    }
    try {
      setPlannerEventBusyId('create');
      await candidateService.createRecruiterAvailabilityEvent({
        title,
        scheduledFor: iso,
        note: plannerEventForm.note.trim() || undefined,
      });
      const chatNotice = `Neuer Termin: ${title} am ${new Date(iso).toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}`;
      await candidateService.createRecruiterTeamMessage(chatNotice);
      setPlannerEventForm({ title: '', scheduledDate: scheduledDateRaw, scheduledTime: '09:00', note: '' });
      await loadPlannerData();
    } catch (e) {
      setPlannerError(e instanceof Error ? e.message : 'Termin konnte nicht erstellt werden.');
    } finally {
      setPlannerEventBusyId(null);
    }
  };

  const handleDeletePlannerEvent = async (eventId: string) => {
    setPlannerError(null);
    try {
      setPlannerEventBusyId(eventId);
      await candidateService.deleteRecruiterAvailabilityEvent(eventId);
      await loadPlannerData();
    } catch (e) {
      setPlannerError(e instanceof Error ? e.message : 'Termin konnte nicht gelöscht werden.');
    } finally {
      setPlannerEventBusyId(null);
    }
  };

  const handleSendPlannerMessage = async () => {
    setPlannerError(null);
    const msg = plannerMessageDraft.trim();
    if (!msg) return;
    try {
      setPlannerMessageSending(true);
      const created = await candidateService.createRecruiterTeamMessage(msg);
      setPlannerMessageDraft('');
      setPlannerMessages((prev) => {
        if (prev.some((m) => m.id === created.id)) return prev;
        return [...prev, created].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      await loadPlannerData();
    } catch (e) {
      setPlannerError(e instanceof Error ? e.message : 'Nachricht konnte nicht gesendet werden.');
    } finally {
      setPlannerMessageSending(false);
    }
  };

  const plannerMonthLabel = useMemo(
    () => plannerCurrentMonth.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' }),
    [plannerCurrentMonth]
  );

  const plannerEventsByDate = useMemo(() => {
    const map = new Map<string, RecruiterAvailabilityEvent[]>();
    for (const evt of plannerEvents) {
      const key = toLocalDateKey(evt.scheduledFor);
      const list = map.get(key) || [];
      list.push(evt);
      map.set(key, list);
    }
    for (const [key, list] of map.entries()) {
      list.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
      map.set(key, list);
    }
    return map;
  }, [plannerEvents]);

  const plannerCalendarDays = useMemo(() => {
    const year = plannerCurrentMonth.getFullYear();
    const month = plannerCurrentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const startDate = new Date(year, month, 1 - startOffset);
    return Array.from({ length: 42 }).map((_, idx) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + idx);
      const key = toLocalDateKey(date);
      const inMonth = date.getMonth() === month;
      const isToday = key === toLocalDateKey(new Date());
      return { date, key, inMonth, isToday };
    });
  }, [plannerCurrentMonth]);

  const selectedPlannerEvents = useMemo(
    () => plannerEventsByDate.get(plannerSelectedDate) || [],
    [plannerEventsByDate, plannerSelectedDate]
  );

  const handleRecruiterEditingClaim = async (cand: CandidateProfile) => {
    const editing = getActiveRecruiterEditing(cand);
    setClaimError(null);
    try {
      setClaimBusyUserId(cand.userId);
      if (editing?.userId === user.id) {
        await candidateService.setRecruiterEditingClaim(cand.userId, false);
        setRecruiterEditingHeartbeatCandidateId((prev) => (prev === cand.userId ? null : prev));
      } else if (editing) {
        if (
          !window.confirm(
            `${editing.label} bearbeitet diesen Kandidaten gerade (Team-Sicht). Wirklich übernehmen? Nur nach Absprache.`
          )
        ) {
          return;
        }
        await candidateService.setRecruiterEditingClaim(cand.userId, true);
        setRecruiterEditingHeartbeatCandidateId(cand.userId);
      } else {
        await candidateService.setRecruiterEditingClaim(cand.userId, true);
        setRecruiterEditingHeartbeatCandidateId(cand.userId);
      }
      if (onRefreshCandidates) await onRefreshCandidates();
    } catch (e: any) {
      setClaimError(e?.message || 'Bearbeitungs-Meldung fehlgeschlagen.');
    } finally {
      setClaimBusyUserId(null);
    }
  };

  const handleDeleteInquiry = async (inq: CandidateInquiry) => {
    if (deletingInquiryId) return;
    if (inquiryDeleteConfirmText.trim().toLowerCase() !== 'löschen') return;

    setInquiryDeleteError(null);
    setDeletingInquiryId(inq.id);
    try {
      await candidateService.deleteInquiry(inq.id);
      setInquiries((prev) => prev.filter((x) => x.id !== inq.id));
      setInquiryDeleteTarget(null);
      setInquiryDeleteConfirmText('');
    } catch (e: any) {
      setInquiryDeleteError(e?.message || 'Löschen fehlgeschlagen.');
    } finally {
      setDeletingInquiryId(null);
    }
  };

  const openInquiryCustomerAttachmentPdf = useCallback((_name: string, data: string) => {
    try {
      const base64 = data.includes('base64,') ? data.split('base64,')[1] : data;
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener');
      window.setTimeout(() => URL.revokeObjectURL(url), 120_000);
    } catch {
      // ignore
    }
  }, []);

  const handleInquiryEditingClaim = async (inq: CandidateInquiry) => {
    if (inquiryClaimBusyId) return;
    const editing = getActiveInquiryEditing(inq);
    setInquiryClaimError(null);
    try {
      setInquiryClaimBusyId(inq.id);
      if (editing?.userId === user.id) {
        await candidateService.setInquiryEditingClaim(inq.id, false);
        setInquiries((prev) =>
          prev.map((x) =>
            x.id === inq.id
              ? { ...x, recruiterEditingUserId: null, recruiterEditingLabel: null, recruiterEditingAt: null }
              : x
          )
        );
      } else {
        if (editing && !window.confirm(`${editing.label} bearbeitet diese Anfrage gerade. Wirklich übernehmen?`)) {
          return;
        }
        const now = new Date().toISOString();
        const label = user.firstName?.trim() || (user.email || '').split('@')[0] || 'Recruiter';
        await candidateService.setInquiryEditingClaim(inq.id, true);
        setInquiries((prev) =>
          prev.map((x) =>
            x.id === inq.id
              ? { ...x, recruiterEditingUserId: user.id, recruiterEditingLabel: label, recruiterEditingAt: now }
              : x
          )
        );
      }
    } catch (e: any) {
      setInquiryClaimError(e?.message || 'Bearbeitungs-Meldung fehlgeschlagen.');
    } finally {
      setInquiryClaimBusyId(null);
    }
  };

  // Während der Bearbeitung die „Bearbeitung melden“-Meldung regelmäßig auffrischen,
  // damit sie für andere Recruiter nicht nach wenigen Stunden verschwindet.
  useEffect(() => {
    if (!selectedCandidate) return;
    if (!recruiterEditingHeartbeatCandidateId) return;
    if (recruiterEditingHeartbeatCandidateId !== selectedCandidate.userId) return;
    if (claimBusyUserId === selectedCandidate.userId) return;
    if (activeView !== 'talents') return; // Claim-UI steckt im Kandidatenmodal (Talents-Ansicht)

    const id = window.setInterval(() => {
      void candidateService.setRecruiterEditingClaim(selectedCandidate.userId, true).catch(() => {
        // Heartbeat Fehler einfach ignorieren; nächste reguläre UI-Refresh holt den Zustand wieder.
      });
    }, RECRUITER_EDITING_CLAIM_HEARTBEAT_MS);

    return () => window.clearInterval(id);
  }, [activeView, selectedCandidate, recruiterEditingHeartbeatCandidateId, claimBusyUserId]);

  const isAdmin = user.role === UserRole.ADMIN;
  // Recruiter dürfen NICHT Stammdaten/Skills/Links bearbeiten (nur Admin).
  const canEdit = isAdmin;

  // Recruiter sollen nicht alle Entwürfe/leer angelegte Profile sehen.
  // Sichtbar: eingereicht ODER bereits veröffentlicht. Admins sehen alles.
  const visibleCandidates = isAdmin
    ? candidates
    : candidates.filter((c) => !!c.isSubmitted || !!c.isPublished || c.status === CandidateStatus.ACTIVE);

  const isCandidateStale = useCallback((cand: CandidateProfile) => {
    const updatedAtMs = new Date(cand.updatedAt).getTime();
    return Number.isFinite(updatedAtMs) && Date.now() - updatedAtMs >= STALE_CANDIDATE_MS;
  }, []);

  const isStaleNeedsReview = useCallback(
    (cand: CandidateProfile) =>
      isCandidateStale(cand) && !(cand.isPublished && cand.status === CandidateStatus.ACTIVE),
    [isCandidateStale]
  );

  const deferredSearchTerm = useDeferredValue(searchTerm);
  const searchFiltered = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    return visibleCandidates
      .slice()
      .sort((a, b) => {
        // Show submitted first
        const aSub = !!a.isSubmitted;
        const bSub = !!b.isSubmitted;
        if (aSub && !bSub) return -1;
        if (bSub && !aSub) return 1;
        return 0;
      })
      .filter((c) =>
        !term ||
        `${c.firstName} ${c.lastName} ${c.candidateNumber || ''}`.toLowerCase().includes(term) ||
        c.industry.toLowerCase().includes(term) ||
        c.skills.some((s) => s.toLowerCase().includes(term))
      );
  }, [visibleCandidates, deferredSearchTerm]);

  const filtered = useMemo(() => {
    if (!onlyStaleUnedited) return searchFiltered;
    return searchFiltered.filter((c) => isCandidateStale(c));
  }, [searchFiltered, onlyStaleUnedited, isCandidateStale]);

  const filteredRegisteredUsers = useMemo(() => {
    const term = deferredSearchTerm.trim().toLowerCase();
    if (!term) return registeredUsers;
    return registeredUsers.filter(
      (u) =>
        u.email.toLowerCase().includes(term) ||
        `${u.firstName} ${u.lastName}`.trim().toLowerCase().includes(term) ||
        u.id.toLowerCase().includes(term)
    );
  }, [registeredUsers, deferredSearchTerm]);

  const runMatchingSearch = useCallback(() => {
    const q = matchingRoleBrief.trim();
    setMatchingQuery(q.length ? q : null);
  }, [matchingRoleBrief]);

  const matchingRankedResults = useMemo(() => {
    if (!matchingQuery?.trim()) return [];
    const ranked = rankCandidates(visibleCandidates, matchingQuery);
    const term = deferredSearchTerm.trim().toLowerCase();
    let list = ranked.filter((r) => r.score > 0);
    if (term) {
      list = list.filter((r) => {
        const c = r.candidate;
        const hay = [
          c.firstName,
          c.lastName,
          c.industry,
          c.profession || '',
          ...(c.skills || []),
          c.about || '',
          c.city,
          c.candidateNumber || '',
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(term);
      });
    }
    return list.slice(0, 50);
  }, [matchingQuery, visibleCandidates, deferredSearchTerm]);

  const filteredCandidateSubmittedCount = useMemo(
    () =>
      filteredRegisteredUsers.filter((u) => effectiveRegisteredUserRole(u) === UserRole.CANDIDATE && u.isPublished).length,
    [filteredRegisteredUsers]
  );

  const filteredCandidateOpenCount = useMemo(
    () =>
      filteredRegisteredUsers.filter((u) => effectiveRegisteredUserRole(u) === UserRole.CANDIDATE && !u.isSubmitted).length,
    [filteredRegisteredUsers]
  );

  const filteredOtherRolesCount = useMemo(
    () => filteredRegisteredUsers.filter((u) => effectiveRegisteredUserRole(u) !== UserRole.CANDIDATE).length,
    [filteredRegisteredUsers]
  );

  const industryGroups = useMemo(() => {
    const sortInGroup = (arr: CandidateProfile[]) =>
      [...arr].sort((a, b) => {
        const aSub = !!a.isSubmitted;
        const bSub = !!b.isSubmitted;
        if (aSub && !bSub) return -1;
        if (bSub && !aSub) return 1;
        return `${a.candidateNumber || ''} ${a.firstName} ${a.lastName}`.localeCompare(
          `${b.candidateNumber || ''} ${b.firstName} ${b.lastName}`,
          'de',
          { sensitivity: 'base' }
        );
      });

    const map = new Map<string, CandidateProfile[]>();
    for (const c of filtered) {
      const key = (c.industry || '').trim();
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(c);
    }

    const groups = Array.from(map.entries()).map(([industry, list]) => ({
      industry,
      candidates: sortInGroup(list),
    }));

    groups.sort((a, b) => a.industry.localeCompare(b.industry, 'de', { sensitivity: 'base' }));

    return groups;
  }, [filtered]);

  const candidateNameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of candidates) {
      const fullName = `${c.firstName || ''} ${c.lastName || ''}`.trim();
      m.set(c.userId, fullName || c.candidateNumber || 'Unbekannter Kandidat');
    }
    return m;
  }, [candidates]);

  const displayProfession = useCallback((cand: CandidateProfile): string => {
    const raw = (cand.profession || '').trim();
    if (raw && raw !== '-' && raw !== '—' && raw.toLowerCase() !== 'n/a') return raw;
    const about = cand.about || '';
    const legacyLine = about.split('\n').find((line) => line.trim().startsWith('[profession]:'));
    if (legacyLine) {
      const encoded = legacyLine.trim().slice('[profession]:'.length);
      try {
        const decoded = decodeURIComponent(encoded || '').trim();
        if (decoded && decoded !== '-' && decoded !== '—' && decoded.toLowerCase() !== 'n/a') return decoded;
      } catch {
        // ignore invalid legacy encoding
      }
    }
    const industry = (cand.industry || '').trim();
    return industry || '-';
  }, []);

  const displaySalaryWish = useCallback((cand: CandidateProfile): string => {
    if (cand.salaryWishEur !== null && cand.salaryWishEur !== undefined && Number.isFinite(Number(cand.salaryWishEur))) {
      return `${cand.salaryWishEur} EUR`;
    }
    const about = cand.about || '';
    const legacyLine = about
      .split('\n')
      .find((line) => {
        const t = line.trim().toLowerCase();
        return t.startsWith('[salary]:') || t.startsWith('[salary_eur]:');
      });
    if (legacyLine) {
      const raw = legacyLine.split(':').slice(1).join(':').trim();
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return `${Math.round(n)} EUR`;
    }
    return '-';
  }, []);

  const displayWorkRadius = useCallback((cand: CandidateProfile): string => {
    if (cand.workArea?.trim()) return cand.workArea.trim();
    if (cand.workRadiusKm !== null && cand.workRadiusKm !== undefined && Number.isFinite(Number(cand.workRadiusKm))) {
      return `${cand.workRadiusKm} km`;
    }
    const about = cand.about || '';
    const legacyLine = about.split('\n').find((line) => line.trim().startsWith('[radius]:'));
    if (legacyLine) {
      const raw = legacyLine.trim().slice('[radius]:'.length);
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) return `${Math.round(n)} km`;
    }
    return '-';
  }, []);

  const candidateReviewHint = useCallback((cand: CandidateProfile) => {
    if (cand.isPublished && cand.status === CandidateStatus.ACTIVE) {
      return {
        text: 'Schon bearbeitet und freigegeben',
        mobileText: '',
        className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      };
    }
    if (isCandidateStale(cand)) {
      return {
        text: 'Bearbeiten nötig',
        mobileText: 'Bearbeiten nötig: seit 3+ Tagen offen',
        className: 'bg-red-50 text-red-700 ring-1 ring-red-200',
      };
    }
    return {
      text: 'In Bearbeitung',
      mobileText: 'Aktuell bearbeitet',
      className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
    };
  }, [isCandidateStale]);

  const handleViewCandidate = async (candidate: CandidateProfile) => {
    setSelectedCandidate(candidate);
    setEditForm(JSON.parse(JSON.stringify(candidate)));
    setIsEditing(false);
    setModalTab('profile');
    setClaimError(null);
    setDocError(null);
    // Performance: große Dokumentdaten (Base64) erst bei Bedarf im Dokumente-Tab laden.
    setCandidateDocs(null);
  };

  useEffect(() => {
    if (!selectedCandidate || (modalTab !== 'documents' && modalTab !== 'edited-documents') || candidateDocs) return;
    let cancelled = false;
    const loadDocs = async () => {
      setIsLoadingDocs(true);
      try {
        const docs = await candidateService.getDocumentsForRecruiter(selectedCandidate.userId);
        if (!cancelled) setCandidateDocs(docs || null);
      } finally {
        if (!cancelled) setIsLoadingDocs(false);
      }
    };
    void loadDocs();
    return () => {
      cancelled = true;
    };
  }, [selectedCandidate, modalTab, candidateDocs]);

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
    if (!candidateDocs?.original?.cvPdf) return 'Bitte zuerst einen Lebenslauf hochladen.';
    return null;
  };

  const handlePublish = async (c: CandidateProfile | null) => {
    if (!c) return;
    setDocError(null);
    setIsPublishing(true);
    try {
      let docs = candidateDocs;
      if (!docs || selectedCandidate?.userId !== c.userId) {
        docs = await candidateService.getDocumentsForRecruiter(c.userId);
        if (selectedCandidate?.userId === c.userId) setCandidateDocs(docs || null);
      }

      if (!docs?.original?.cvPdf) {
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
      await candidateService.updateEditedDocuments(selectedCandidate.userId, nextDocs);
      const fresh = await candidateService.getDocumentsForRecruiter(selectedCandidate.userId);
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
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({ ...base, userId: selectedCandidate.userId, cvPdf: { name: up.name, data: up.data } });
  };

  const handleRemoveCv = async () => {
    if (!selectedCandidate) return;
    if (!window.confirm('Lebenslauf wirklich entfernen?')) return;
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({ ...base, userId: selectedCandidate.userId, cvPdf: undefined });
  };

  const handleAddCertificates = async (files: FileList | null) => {
    if (!files || files.length === 0 || !selectedCandidate) return;
    const results = await documentService.uploadMultiplePdfs(files);
    if (!results.length) {
      setDocError('Keine gültigen PDFs ausgewählt.');
      return;
    }
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({
      ...base,
      userId: selectedCandidate.userId,
      certificates: [...(base.certificates || []), ...results]
    });
  };

  const handleRemoveCertificate = async (idx: number) => {
    if (!selectedCandidate) return;
    if (!window.confirm('Zertifikat wirklich entfernen?')) return;
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
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
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
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
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
    await saveDocs({
      ...base,
      userId: selectedCandidate.userId,
      qualifications: [...(base.qualifications || []), ...results]
    });
  };

  const handleRemoveQualification = async (idx: number) => {
    if (!selectedCandidate) return;
    if (!window.confirm('Qualifikation wirklich entfernen?')) return;
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
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
    const base: CandidateDocuments = candidateDocs?.edited || { userId: selectedCandidate.userId, certificates: [], qualifications: [] };
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

  const handleConfirmDeleteRegisteredUser = async () => {
    if (!userDeleteTarget || userDeleteTarget.id === user.id) return;
    if (userDeleteConfirmText.trim().toLowerCase() !== 'löschen') return;
    const id = userDeleteTarget.id;
    setRegisteredUsersError(null);
    setDeletingUserId(id);
    try {
      await Promise.resolve(onAdminAction(id, 'delete', undefined, user.id));
      setRegisteredUsers((prev) => prev.filter((u) => u.id !== id));
      setUserDeleteTarget(null);
      setUserDeleteConfirmText('');
      await onRefreshCandidates?.();
    } catch (e) {
      setRegisteredUsersError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.');
    } finally {
      setDeletingUserId(null);
    }
  };

  const handleUnpublishRegisteredCandidate = async (target: RegisteredUserListItem) => {
    if (target.id === user.id) return;
    setRegisteredUsersError(null);
    setRegisteredUsersSuccess(null);
    setUnpublishingUserId(target.id);
    try {
      await candidateService.adminAction(target.id, 'unpublish', undefined, user.id);
      await onRefreshCandidates?.();
      const list = await candidateService.listRegisteredUsers();
      setRegisteredUsers(list);
      setRegisteredUsersSuccess('Kandidat ist nicht mehr im Marktplatz sichtbar.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Vom Marktplatz entfernen fehlgeschlagen.';
      setRegisteredUsersError(msg);
    } finally {
      setUnpublishingUserId(null);
    }
  };

  const handleCreateExternalCandidate = async () => {
    setExternalError(null);
    setExternalSuccess(null);
    if (!externalForm.city.trim() || !externalForm.country.trim() || !externalForm.industry.trim() || !externalForm.availability.trim()) {
      setExternalError('Bitte Stadt, Land, Branche und Verfügbarkeit ausfüllen.');
      return;
    }
    if (!externalDocs.cvPdf?.data || !externalDocs.cvPdf?.name) {
      setExternalError('Lebenslauf (CV) ist Pflicht.');
      return;
    }
    if (!externalDocs.qualifications.length) {
      setExternalError('Mindestens eine Qualifikation ist Pflicht.');
      return;
    }
    try {
      setIsCreatingExternal(true);
      const skills = externalForm.skillsRaw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const { workRadiusKm, workArea } = parseWorkUmkreisOption(externalForm.workUmkreis);
      await candidateService.createExternalCandidate({
        firstName: externalForm.firstName.trim() || undefined,
        lastName: externalForm.lastName.trim() || undefined,
        city: externalForm.city,
        country: externalForm.country,
        industry: externalForm.industry,
        profession: externalForm.profession.trim() || undefined,
        experienceYears: Number(externalForm.experienceYears || 0),
        availability: externalForm.availability,
        salaryWishEur: Number(externalForm.salaryWishEur || 0) > 0 ? Number(externalForm.salaryWishEur) : undefined,
        workRadiusKm,
        workArea,
        about: externalForm.about.trim() || undefined,
        languages: externalForm.languagesRaw.trim() || undefined,
        skills,
        boostedKeywords: externalBoostedKeywords,
        cvPdf: externalDocs.cvPdf,
        certificates: externalDocs.certificates,
        qualifications: externalDocs.qualifications,
        isPublished: true,
      });
      if (onRefreshCandidates) await onRefreshCandidates();
      setExternalSuccess('Kandidat wurde erstellt und für den Marktplatz freigegeben.');
      setExternalForm((prev) => ({
        ...prev,
        firstName: '',
        lastName: '',
        city: '',
        about: '',
        profession: '',
        languagesRaw: '',
        skillsRaw: '',
        experienceYears: '',
        salaryWishEur: '',
        workUmkreis: WORK_UMKREIS_OPTIONS[0] || '+25',
      }));
      setExternalBoostedKeywords([]);
      setExternalDocs({
        userId: 'external:new',
        certificates: [],
        qualifications: [],
      });
    } catch (e: any) {
      setExternalError(e?.message || 'Externer Kandidat konnte nicht erstellt werden.');
    } finally {
      setIsCreatingExternal(false);
    }
  };

  const toggleExternalKeyword = (keyword: string) => {
    setExternalBoostedKeywords((prev) =>
      prev.includes(keyword) ? prev.filter((k) => k !== keyword) : [...prev, keyword]
    );
  };

  const handleExternalCvUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const result = await documentService.uploadPdf(files[0]);
    if (result.success && result.data && result.name) {
      setExternalDocs((prev) => ({ ...prev, cvPdf: { name: result.name!, data: result.data! } }));
    }
  };

  const handleExternalCertificatesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const results = await documentService.uploadMultiplePdfs(files);
    setExternalDocs((prev) => ({ ...prev, certificates: [...prev.certificates, ...results] }));
  };

  const handleExternalQualificationsUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const results = await documentService.uploadMultiplePdfs(files);
    setExternalDocs((prev) => ({ ...prev, qualifications: [...prev.qualifications, ...results] }));
  };

  const renderTeamControls = useCallback((cand: CandidateProfile, fullWidth = false) => {
    const alreadyReleased = cand.isPublished && cand.status === CandidateStatus.ACTIVE;
    const editing = getActiveRecruiterEditing(cand);
    const busy = claimBusyUserId === cand.userId;
    const wrap = fullWidth ? 'flex w-full flex-col gap-2' : 'flex flex-col items-start gap-1.5';
    if (alreadyReleased && !editing) {
      return (
        <div className={wrap}>
          <span className="max-w-full rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[10px] font-black uppercase leading-tight tracking-wide text-emerald-700 ring-1 ring-emerald-200">
            Schon bearbeitet und freigegeben
          </span>
        </div>
      );
    }
    if (editing) {
      const mine = editing.userId === user.id;
      if (!mine) {
        return (
          <div className={wrap}>
            <span
              className="max-w-full rounded-lg bg-slate-900 px-2.5 py-1.5 text-[10px] font-black uppercase leading-tight tracking-wide text-slate-100 ring-1 ring-slate-700 shadow-[0_8px_20px_-14px_rgba(15,23,42,0.85)]"
              title={`${editing.label} bearbeitet diesen Kandidaten aktuell.`}
            >
              {editing.label} bearbeitet gerade
            </span>
          </div>
        );
      }
      return (
        <div className={wrap}>
          <span
            className={`max-w-full text-[10px] font-black uppercase leading-tight tracking-wide ${mine ? 'text-emerald-700' : 'text-amber-800'}`}
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
            variant="outline"
            className={`h-9 rounded-lg px-3 text-[10px] font-black ${fullWidth ? 'w-full justify-center' : ''}`}
            disabled={busy}
            onClick={() => void handleRecruiterEditingClaim(cand)}
          >
            Fertig – freigeben
          </Button>
        </div>
      );
    }
    return (
      <Button
        size="sm"
        variant="outline"
        className={`h-9 rounded-lg border-amber-200 px-3 text-[10px] font-black text-amber-900 hover:bg-amber-50 ${fullWidth ? 'w-full justify-center' : ''}`}
        disabled={busy}
        title="Klicken = für alle Recruiter sichtbar: Sie bearbeiten diesen Kandidaten. Bleibt aktiv, bis Sie „Fertig – freigeben“ wählen."
        onClick={() => void handleRecruiterEditingClaim(cand)}
      >
        Ich bearbeite
      </Button>
    );
  }, [claimBusyUserId, user.id, handleRecruiterEditingClaim]);

  const renderPublishAndManage = useCallback((cand: CandidateProfile, fullWidth = false) => (
    <div className={fullWidth ? 'flex w-full flex-col gap-2' : 'inline-flex items-center gap-2'}>
      {!cand.isPublished && (!!cand.isSubmitted || cand.status === CandidateStatus.ACTIVE) && (
        <Button
          size="sm"
          variant="primary"
          className={`h-10 rounded-xl px-3 text-[11px] font-black ${fullWidth ? 'w-full justify-center' : ''}`}
          onClick={() => onAdminAction(cand.userId, 'publish', undefined, user.id)}
          disabled={!cand.cvReviewedAt}
        >
          FREIGEBEN
        </Button>
      )}
      <Button
        size="sm"
        variant="ghost"
        className={`h-10 px-3 text-xs font-black text-orange-600 ${fullWidth ? 'w-full justify-center border border-orange-200 bg-orange-50/50' : ''}`}
        onClick={() => handleViewCandidate(cand)}
      >
        MANAGE
      </Button>
    </div>
  ), [onAdminAction, user.id, handleViewCandidate]);

  const statusBadgeBlock = useCallback((cand: CandidateProfile) => (
    <>
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
          className={`text-[10px] font-black uppercase tracking-widest ${cand.cvReviewedAt ? 'text-emerald-600' : 'text-orange-600'}`}
        >
          {cand.cvReviewedAt ? 'CV geprüft' : 'CV offen'}
        </div>
      )}
    </>
  ), []);

  return (
    <div className="flex min-h-screen min-h-[100dvh] bg-slate-50 font-inter">
      {/* Sidebar - SCALED DOWN */}
      <aside className="hidden w-[17.5rem] shrink-0 flex-col border-r border-slate-800/80 bg-slate-900 text-slate-300 md:flex">
        <div className="p-6">
          <div className="mb-6 flex w-full items-center">
            <CmsLogoHeroBadge variant="compact" className="w-full !justify-start" />
          </div>
          <p className="mb-3 px-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Navigation</p>
          <nav className="space-y-1">
            <button
              type="button"
              onClick={() => setActiveView('talents')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeView === 'talents'
                  ? 'border-l-[3px] border-orange-500 bg-white/[0.07] pl-[9px] text-white ring-1 ring-white/10'
                  : 'border-l-[3px] border-transparent pl-3 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${activeView === 'talents' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </span>
              <span className="leading-snug">Talents</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('inquiries')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeView === 'inquiries'
                  ? 'border-l-[3px] border-orange-500 bg-white/[0.07] pl-[9px] text-white ring-1 ring-white/10'
                  : 'border-l-[3px] border-transparent pl-3 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${activeView === 'inquiries' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-7 7h12a2 2 0 002-2V7l-4-4H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              <span className="leading-snug">Externe Interessen</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('matching')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeView === 'matching'
                  ? 'border-l-[3px] border-orange-500 bg-white/[0.07] pl-[9px] text-white ring-1 ring-white/10'
                  : 'border-l-[3px] border-transparent pl-3 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${activeView === 'matching' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </span>
              <span className="leading-snug">KI-Matching</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('planner')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeView === 'planner'
                  ? 'border-l-[3px] border-orange-500 bg-white/[0.07] pl-[9px] text-white ring-1 ring-white/10'
                  : 'border-l-[3px] border-transparent pl-3 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${activeView === 'planner' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-12 9h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v11a2 2 0 002 2z" />
                </svg>
              </span>
              <span className="leading-snug">Verfügbarkeitskalender & Chat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('external')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeView === 'external'
                  ? 'border-l-[3px] border-orange-500 bg-white/[0.07] pl-[9px] text-white ring-1 ring-white/10'
                  : 'border-l-[3px] border-transparent pl-3 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${activeView === 'external' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
              </span>
              <span className="leading-snug">Kandidat hinzufügen</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('users')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeView === 'users'
                  ? 'border-l-[3px] border-orange-500 bg-white/[0.07] pl-[9px] text-white ring-1 ring-white/10'
                  : 'border-l-[3px] border-transparent pl-3 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${activeView === 'users' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </span>
              <span className="leading-snug">Nutzer</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveView('calculator')}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all ${
                activeView === 'calculator'
                  ? 'border-l-[3px] border-orange-500 bg-white/[0.07] pl-[9px] text-white ring-1 ring-white/10'
                  : 'border-l-[3px] border-transparent pl-3 text-slate-400 hover:bg-white/[0.04] hover:text-slate-100'
              }`}
            >
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md ${activeView === 'calculator' ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500'}`}>
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                  <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </span>
              <span className="leading-snug">Kalkulator</span>
            </button>
          </nav>
        </div>
        <div className="mt-auto p-6 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-orange-600 flex items-center justify-center font-black text-white text-xs">{user.email.charAt(0).toUpperCase()}</div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white truncate uppercase tracking-tight">RECRUITER</div>
              <div className="text-[10px] text-slate-500 font-bold truncate">{user.email}</div>
            </div>
          </div>
          <button onClick={onLogout} className="text-[10px] font-black text-slate-500 hover:text-orange-500 transition-colors uppercase tracking-widest flex items-center gap-2">Logout</button>
        </div>
      </aside>

      {/* Main Content - SCALED DOWN */}
      <main className="flex h-screen min-h-0 flex-1 flex-col overflow-hidden">
        {/* Mobil: Logo + Titel + Logout (Sidebar fehlt) */}
        <div
          className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-800 bg-slate-900 px-3 py-2.5 md:hidden"
          style={{ paddingTop: 'max(0.625rem, env(safe-area-inset-top, 0px))' }}
        >
          <div className="shrink-0">
            <CmsLogoHeroBadge variant="compact" className="!justify-start" />
          </div>
          <h1 className="min-w-0 flex-1 truncate text-center text-xs font-black uppercase tracking-tight text-white">
            Dashboard
          </h1>
          <button
            type="button"
            onClick={onLogout}
            className="shrink-0 rounded-lg px-2 py-2 text-[10px] font-black uppercase tracking-wide text-slate-300 transition-colors hover:bg-white/10 hover:text-orange-400"
          >
            Logout
          </button>
        </div>

        <header className="relative z-10 flex min-h-0 flex-col gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-3 shadow-[0_1px_0_rgba(15,23,42,0.04)] backdrop-blur-sm sm:px-6 md:min-h-[4.25rem] md:flex-row md:items-center md:justify-between md:gap-4 md:py-3">
          {/* Mobil: Tabs zuerst (sofort sichtbar), Suche darunter — vorher war die Suche order-1 und verdrängte die Tab-Leiste nach unten. */}
          <div className="order-1 flex min-w-0 w-full flex-1 flex-col gap-3 md:order-1 md:flex-row md:items-center md:gap-5">
            <div className="hidden shrink-0 md:block">
              <h1 className="text-lg font-semibold tracking-tight text-slate-900">Dashboard</h1>
              <p className="text-xs font-medium text-slate-500">Recruiting · CMS Talents</p>
            </div>
            <div
              className="hidden h-9 w-px shrink-0 bg-gradient-to-b from-transparent via-slate-300/90 to-transparent md:block"
              aria-hidden
            />
            <nav
              className="flex min-w-0 w-full flex-1 touch-pan-x flex-nowrap items-center gap-1 overflow-x-auto overflow-y-hidden overscroll-x-contain scroll-px-2 rounded-2xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/90 p-1 pb-1.5 shadow-[0_2px_12px_-4px_rgba(15,23,42,0.1)] ring-1 ring-slate-900/[0.04] [-ms-overflow-style:none] [scrollbar-width:thin] md:flex-wrap md:overflow-x-visible md:overflow-y-visible md:pb-1 md:[scrollbar-width:none] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 md:[&::-webkit-scrollbar]:hidden"
              aria-label="Hauptnavigation"
            >
              <button
                type="button"
                onClick={() => setActiveView('talents')}
                className={`inline-flex shrink-0 min-h-[2rem] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 sm:px-3.5 sm:text-xs ${
                  activeView === 'talents'
                    ? 'border border-blue-950/50 bg-gradient-to-b from-slate-900 to-blue-950 text-white shadow-md shadow-blue-950/35'
                    : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white hover:text-slate-900'
                }`}
              >
                Talents
              </button>
              <button
                type="button"
                onClick={() => setActiveView('inquiries')}
                className={`inline-flex shrink-0 min-h-[2rem] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 sm:px-3.5 sm:text-xs ${
                  activeView === 'inquiries'
                    ? 'border border-blue-950/50 bg-gradient-to-b from-slate-900 to-blue-950 text-white shadow-md shadow-blue-950/35'
                    : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline">Externe </span>
                Interessen
              </button>
              <button
                type="button"
                onClick={() => setActiveView('matching')}
                className={`inline-flex shrink-0 min-h-[2rem] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 sm:px-3.5 sm:text-xs ${
                  activeView === 'matching'
                    ? 'border border-blue-950/50 bg-gradient-to-b from-slate-900 to-blue-950 text-white shadow-md shadow-blue-950/35'
                    : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline">KI-Matching</span>
                <span className="sm:hidden">KI</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('planner')}
                className={`inline-flex shrink-0 min-h-[2rem] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 sm:px-3.5 sm:text-xs ${
                  activeView === 'planner'
                    ? 'border border-blue-950/50 bg-gradient-to-b from-slate-900 to-blue-950 text-white shadow-md shadow-blue-950/35'
                    : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white hover:text-slate-900'
                }`}
              >
                Kalender & Chat
              </button>
              <button
                type="button"
                onClick={() => setActiveView('external')}
                className={`inline-flex shrink-0 min-h-[2rem] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 sm:px-3.5 sm:text-xs ${
                  activeView === 'external'
                    ? 'border border-blue-950/50 bg-gradient-to-b from-slate-900 to-blue-950 text-white shadow-md shadow-blue-950/35'
                    : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white hover:text-slate-900'
                }`}
              >
                <span className="hidden sm:inline">Kandidat hinzufügen</span>
                <span className="sm:hidden">+ Kandidat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveView('users')}
                className={`inline-flex shrink-0 min-h-[2rem] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 sm:px-3.5 sm:text-xs ${
                  activeView === 'users'
                    ? 'border border-blue-950/50 bg-gradient-to-b from-slate-900 to-blue-950 text-white shadow-md shadow-blue-950/35'
                    : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white hover:text-slate-900'
                }`}
              >
                Nutzer
              </button>
              <button
                type="button"
                onClick={() => setActiveView('calculator')}
                className={`inline-flex shrink-0 min-h-[2rem] items-center justify-center rounded-xl px-3 py-1.5 text-[11px] font-semibold tracking-wide transition-all duration-200 sm:px-3.5 sm:text-xs ${
                  activeView === 'calculator'
                    ? 'border border-blue-950/50 bg-gradient-to-b from-slate-900 to-blue-950 text-white shadow-md shadow-blue-950/35'
                    : 'border border-transparent text-slate-600 hover:border-slate-200/80 hover:bg-white hover:text-slate-900'
                }`}
              >
                Kalkulator
              </button>
            </nav>
          </div>
          <div
            className={`relative order-2 w-full min-w-0 md:order-2 md:max-w-sm md:flex-1 lg:max-w-md ${activeView === 'calculator' || activeView === 'planner' ? 'hidden' : ''}`}
          >
            <input
              type="search"
              enterKeyHint="search"
              placeholder={
                activeView === 'users'
                  ? 'Nutzer: E-Mail, Name…'
                  : activeView === 'matching'
                    ? 'Vorschläge nach Name, Branche, Skills filtern…'
                    : 'Suchen nach Name, Branche, Skills…'
              }
              className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-10 pr-4 text-xs font-bold text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/10 md:h-10 md:py-1.5"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoComplete="off"
            />
            <svg
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-slate-50/50 p-3 pb-[max(1.25rem,env(safe-area-inset-bottom,0px))] sm:p-6 sm:pb-8"
        >
          {activeView === 'inquiries' ? (
            <div className="overflow-x-clip rounded-3xl border border-slate-200/90 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)]">
              <div className="relative overflow-x-clip border-b border-white/10 bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-950 px-4 py-4 sm:px-8 sm:py-8">
                <div className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-orange-500/15 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" aria-hidden />
                <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-400/95">Talent-Marktplatz</p>
                    <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">Externe Interessen</h2>
                    <p className="mt-2 hidden max-w-xl text-sm leading-relaxed text-slate-400 sm:block">
                      Anfragen von Kunden und Interessenten zu Profilen im Marktplatz – zentral bearbeiten, kontaktieren und zuordnen.
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold text-white backdrop-blur-sm ${
                        isLoadingInquiries ? 'animate-pulse' : ''
                      }`}
                    >
                      <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]" aria-hidden />
                      {isLoadingInquiries
                        ? 'Wird geladen…'
                        : `${inquiries.length} Anfrage${inquiries.length === 1 ? '' : 'n'}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-4 bg-gradient-to-b from-slate-50/90 to-slate-50 p-4 sm:p-6">
                {inquiryDeleteError && (
                  <div className="rounded-2xl border border-red-200/80 bg-red-50 px-4 py-3 text-xs font-semibold text-red-800 shadow-sm">
                    {inquiryDeleteError}
                  </div>
                )}
                {inquiryClaimError && (
                  <div className="rounded-2xl border border-amber-200/80 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-900 shadow-sm">
                    {inquiryClaimError}
                  </div>
                )}

                {isLoadingInquiries && inquiries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
                    <div className="h-10 w-10 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" aria-hidden />
                    <p className="mt-4 text-sm font-semibold text-slate-700">Anfragen werden geladen…</p>
                  </div>
                ) : inquiries.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200/90 bg-white px-6 py-16 text-center shadow-sm">
                    <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-100 to-slate-50 text-slate-400 shadow-inner ring-1 ring-slate-200/80">
                      <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                        <path strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5m-7 7h12a2 2 0 002-2V7l-4-4H6a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <p className="text-base font-semibold text-slate-800">Noch keine Interessenanfragen</p>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                      Sobald sich Interessenten über den Marktplatz melden, erscheinen die Anfragen hier mit Kontaktdaten und Kontext.
                    </p>
                  </div>
                ) : (
                  <ul className="space-y-4 pr-1 md:max-h-[min(70vh,720px)] md:overflow-y-auto [scrollbar-width:thin] md:[scrollbar-color:rgba(148,163,184,0.5)_transparent]">
                    {inquiries.slice(0, 200).map((inq) => {
                      const editing = getActiveInquiryEditing(inq);
                      const isMine = editing?.userId === user.id;
                      const talentLabelForMail =
                        inq.candidateUserId == null
                          ? 'Allgemeine Marktplatz-Anfrage'
                          : candidateNameById.get(inq.candidateUserId) || 'Kandidat';
                      const mailSubject = encodeURIComponent(`Rueckmeldung zu Ihrer Anfrage (${talentLabelForMail})`);
                      const mailBody = encodeURIComponent(
                        `Hallo ${inq.contactName},\n\nvielen Dank fuer Ihr Interesse.\n\nBeste Gruesse\n${user.firstName?.trim() || 'Recruiter-Team'}`
                      );
                      const candidateLabel =
                        inq.candidateUserId == null
                          ? 'Allgemeine Marktplatz-Anfrage'
                          : candidateNameById.get(inq.candidateUserId) || inq.candidateUserId;
                      const created = new Date(inq.createdAt);
                      const initials = contactInitialsFromName(inq.contactName);
                      const inquiryDetailRows = parseMarketplaceInquiryDetails(inq.message);
                      return (
                        <li key={inq.id}>
                          <article className="group relative overflow-x-clip rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition-all duration-200 hover:border-slate-300/90 hover:shadow-md sm:p-5">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:justify-between lg:gap-6">
                              <div className="flex min-h-0 min-w-0 w-full flex-1 gap-4">
                                <div
                                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-bold text-white shadow-md shadow-orange-500/25 ring-1 ring-white/20"
                                  aria-hidden
                                >
                                  {initials}
                                </div>
                                <div className="min-h-0 min-w-0 flex-1 space-y-3 [overflow-wrap:anywhere]">
                                  <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Interessent</p>
                                      <p className="truncate text-base font-semibold text-slate-900">{inq.contactName}</p>
                                    </div>
                                    <time
                                      className="shrink-0 rounded-full border border-slate-200/90 bg-slate-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                                      dateTime={inq.createdAt}
                                    >
                                      {created.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
                                    </time>
                                  </div>
                                  <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-slate-600">
                                    <a
                                      href={`mailto:${encodeURIComponent(inq.contactEmail)}`}
                                      className="inline-flex min-w-0 items-center gap-1.5 font-medium text-slate-700 underline decoration-slate-300 underline-offset-2 transition-colors hover:text-orange-600 hover:decoration-orange-300"
                                    >
                                      <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                      </svg>
                                      <span className="truncate">{inq.contactEmail}</span>
                                    </a>
                                    <span className="inline-flex items-center gap-1.5">
                                      <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                                        <path strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                      </svg>
                                      {inq.contactPhone}
                                    </span>
                                  </div>
                                  {inq.message ? (
                                    inquiryDetailRows ? (
                                      <div className="rounded-xl border border-orange-100/90 bg-gradient-to-br from-orange-50/50 via-white to-slate-50/80 px-3 py-3 shadow-sm ring-1 ring-orange-100/50">
                                        <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-900/70">
                                          Projektdetails
                                        </p>
                                        <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                                          {inquiryDetailRows.map((row) => (
                                            <div
                                              key={`${inq.id}-${row.label}`}
                                              className="rounded-lg border border-white/80 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur-[2px]"
                                            >
                                              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{row.label}</dt>
                                              <dd className="mt-1 break-words text-sm font-medium leading-snug text-slate-900">{row.value}</dd>
                                            </div>
                                          ))}
                                        </dl>
                                      </div>
                                    ) : (
                                      <div className="rounded-xl border border-slate-100 bg-white px-3 py-2.5 ring-1 ring-slate-100">
                                        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Nachricht</p>
                                        <p className="text-sm leading-relaxed text-slate-600">{inq.message}</p>
                                      </div>
                                    )
                                  ) : null}
                                  <div className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Bezogen auf Talent</p>
                                    <p className="mt-0.5 font-semibold text-slate-800">{candidateLabel}</p>
                                  </div>
                                  {(inq.customerAttachments?.length ?? 0) > 0 ? (
                                    <div className="rounded-xl border border-sky-100/90 bg-gradient-to-br from-sky-50/80 via-white to-slate-50/80 px-3 py-3 shadow-sm ring-1 ring-sky-100/60">
                                      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-sky-900/80">
                                        Unterlagen vom Kunden (PDF)
                                      </p>
                                      <ul className="flex flex-col gap-2">
                                        {inq.customerAttachments!.map((att, attIdx) => (
                                          <li key={`${inq.id}-att-${attIdx}`}>
                                            <button
                                              type="button"
                                              onClick={() => openInquiryCustomerAttachmentPdf(att.name, att.data)}
                                              className="inline-flex w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-white/90 bg-white/95 px-3 py-2 text-left text-sm font-semibold text-slate-800 shadow-sm transition hover:border-sky-200 hover:bg-sky-50/50"
                                            >
                                              <span className="truncate">{att.name}</span>
                                              <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-sky-700">
                                                Öffnen
                                              </span>
                                            </button>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                  {editing ? (
                                    <p
                                      className={`inline-flex max-w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide ${
                                        isMine ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200/80' : 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80'
                                      }`}
                                    >
                                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isMine ? 'bg-emerald-500' : 'bg-amber-500'}`} aria-hidden />
                                      {isMine ? 'Du bearbeitest diese Anfrage gerade' : `${editing.label} bearbeitet diese Anfrage gerade`}
                                    </p>
                                  ) : null}
                                </div>
                              </div>
                              <div className="flex shrink-0 flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:flex-wrap lg:w-52 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={isMine ? 'outline' : 'secondary'}
                                  className="h-9 w-full justify-center text-[11px] font-bold sm:flex-1 lg:w-full"
                                  isLoading={inquiryClaimBusyId === inq.id}
                                  disabled={inquiryClaimBusyId === inq.id}
                                  onClick={() => void handleInquiryEditingClaim(inq)}
                                  title={isMine ? 'Bearbeitung beenden' : 'Bearbeitung melden'}
                                >
                                  {isMine ? 'Bearbeitung beenden' : 'Ich bearbeite'}
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-9 w-full justify-center text-[11px] font-bold sm:flex-1 lg:w-full"
                                  onClick={() => window.open(`mailto:${inq.contactEmail}?subject=${mailSubject}&body=${mailBody}`, '_self')}
                                  title="E-Mail an Interessent senden"
                                >
                                  E-Mail senden
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="danger"
                                  className="h-9 w-full justify-center text-[11px] font-bold sm:flex-1 lg:w-full"
                                  isLoading={deletingInquiryId === inq.id}
                                  disabled={deletingInquiryId === inq.id}
                                  onClick={() => {
                                    setInquiryDeleteTarget(inq);
                                    setInquiryDeleteConfirmText('');
                                  }}
                                  title="Anfrage löschen"
                                >
                                  Löschen
                                </Button>
                              </div>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          ) : activeView === 'planner' ? (
            <div className="space-y-4">
              <div className="overflow-x-clip rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 text-white sm:px-5 sm:py-4">
                  <h3 className="text-xs font-black uppercase tracking-widest sm:text-sm">Verfügbarkeitskalender & Team-Chat</h3>
                  <p className="mt-1 text-[11px] font-medium text-slate-300 sm:text-xs">
                    Gemeinsame Übersicht für Aufgaben, Termine und schnelle Abstimmung aller Recruiter.
                  </p>
                </div>
                {plannerError && (
                  <div className="mx-4 mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                    {plannerError}
                  </div>
                )}
                <div className="grid grid-cols-1 gap-4 p-4">
                  <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="mx-auto w-full max-w-5xl rounded-2xl border border-[#1b2a47] bg-[#101B31] p-2 shadow-sm sm:p-4">
                      <div className="mb-3 flex flex-col gap-2 sm:mb-4 sm:flex-row sm:items-center sm:justify-between">
                        <h4 className="text-xl font-black capitalize tracking-tight text-white sm:text-3xl">{plannerMonthLabel}</h4>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                            onClick={() => setPlannerCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
                            aria-label="Vorheriger Monat"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/20 bg-white/10 text-white transition hover:bg-white/20"
                            onClick={() => setPlannerCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
                            aria-label="Nächster Monat"
                          >
                            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
                          </button>
                        </div>
                      </div>

                      <div className="w-full overflow-x-auto overflow-y-visible [-webkit-overflow-scrolling:touch]">
                        <div className="min-w-[300px] sm:min-w-0">
                      <div className="grid grid-cols-7 gap-0.5 sm:gap-2">
                        {PLANNER_WEEKDAY_LABELS.map((d) => (
                          <div key={d} className="rounded-lg py-1.5 text-center text-[10px] font-black tracking-wide text-slate-200 sm:py-2 sm:text-sm">{d}</div>
                        ))}
                        {plannerCalendarDays.map((cell) => {
                          const events = plannerEventsByDate.get(cell.key) || [];
                          const isSelected = cell.key === plannerSelectedDate;
                          return (
                            <button
                              key={cell.key}
                              type="button"
                              onClick={() => {
                                setPlannerSelectedDate(cell.key);
                                setPlannerEventForm((s) => ({ ...s, scheduledDate: cell.key, scheduledTime: s.scheduledTime || '09:00' }));
                              }}
                              className={`min-h-[52px] rounded-xl border p-1 text-left transition sm:min-h-[78px] sm:rounded-2xl sm:p-2 ${
                                isSelected
                                  ? 'border-orange-300 bg-white shadow-sm ring-2 ring-orange-200'
                                  : cell.inMonth
                                    ? 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                                    : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm'
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between">
                                <span className={`text-[11px] font-black sm:text-sm ${cell.isToday ? 'text-orange-600' : 'text-slate-800'}`}>
                                  {cell.date.getDate()}
                                </span>
                                {events.length > 0 ? (
                                  <span className="rounded-full bg-slate-900 px-2 py-0.5 text-[10px] font-black text-white">{events.length}</span>
                                ) : null}
                              </div>
                              <div className="space-y-1">
                                {events.slice(0, 2).map((evt) => (
                                  <div key={evt.id} className="truncate rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700">
                                    {new Date(evt.scheduledFor).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {evt.title}
                                  </div>
                                ))}
                                {events.length > 2 ? (
                                  <div className="text-[10px] font-bold text-slate-500">+{events.length - 2} weitere</div>
                                ) : null}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
                      <div className="rounded-xl border border-[#1b2a47] bg-[#101B31] p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-200">
                          Termine am {new Date(`${plannerSelectedDate}T00:00:00`).toLocaleDateString('de-DE', { dateStyle: 'full' })}
                        </p>
                        <div className="mt-2 max-h-48 space-y-2 overflow-y-auto pr-1">
                          {selectedPlannerEvents.length === 0 ? (
                            <p className="text-xs font-semibold text-slate-300">Keine Einträge für diesen Tag.</p>
                          ) : selectedPlannerEvents.map((evt) => (
                            <div key={evt.id} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate text-sm font-bold text-slate-800">{evt.title}</p>
                                  <p className="text-xs font-semibold text-slate-500">
                                    {new Date(evt.scheduledFor).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} · {evt.createdByLabel}
                                  </p>
                                  {evt.note ? <p className="mt-1 text-xs text-slate-600">{evt.note}</p> : null}
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="danger"
                                  className="h-7 px-2 text-[10px] font-black"
                                  isLoading={plannerEventBusyId === evt.id}
                                  disabled={plannerEventBusyId === evt.id}
                                  onClick={() => void handleDeletePlannerEvent(evt.id)}
                                >
                                  Löschen
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-[#1b2a47] bg-[#101B31] p-3">
                        <p className="text-xs font-black uppercase tracking-widest text-slate-200">Neuen Termin anlegen</p>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          <Input
                            value={plannerEventForm.title}
                            onChange={(e) => setPlannerEventForm((s) => ({ ...s, title: e.target.value }))}
                            placeholder="Was ist zu tun? (z. B. Interview Kunde Müller)"
                            className="h-10"
                          />
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                            <Input
                              type="text"
                              value={plannerEventForm.scheduledDate}
                              onChange={(e) => setPlannerEventForm((s) => ({ ...s, scheduledDate: e.target.value }))}
                              placeholder="Datum (YYYY-MM-DD)"
                              className="h-10"
                            />
                            <Input
                              type="text"
                              value={plannerEventForm.scheduledTime}
                              onChange={(e) => setPlannerEventForm((s) => ({ ...s, scheduledTime: e.target.value }))}
                              placeholder="Uhrzeit (HH:mm)"
                              className="h-10"
                            />
                          </div>
                          <Textarea
                            value={plannerEventForm.note}
                            onChange={(e) => setPlannerEventForm((s) => ({ ...s, note: e.target.value }))}
                            placeholder="Notiz (optional)"
                            rows={3}
                          />
                          <Button
                            type="button"
                            variant="primary"
                            className="h-10 text-xs font-black uppercase tracking-wide"
                            isLoading={plannerEventBusyId === 'create'}
                            onClick={() => void handleCreatePlannerEvent()}
                          >
                            Termin speichern
                          </Button>
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="w-full rounded-xl border border-slate-200 bg-slate-50/50 p-4">
                    <div className="overflow-x-clip rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-900 to-slate-800 px-4 py-3 text-white">
                        <div>
                          <h4 className="text-sm font-black uppercase tracking-widest">Recruiter-Teamchat</h4>
                          <p className="mt-0.5 text-[11px] font-medium text-slate-300">Abstimmung im Team in Echtzeit</p>
                        </div>
                      </div>
                      <div className="bg-gradient-to-b from-slate-50 to-white p-3">
                        <div
                          ref={plannerChatScrollRef}
                          className="max-h-[min(50vh,420px)] space-y-2 overflow-y-auto overflow-x-hidden overscroll-y-contain pr-1 sm:max-h-[64vh]"
                        >
                          {plannerLoading && plannerMessages.length === 0 ? (
                            <p className="py-6 text-center text-xs font-semibold text-slate-500">Chat wird geladen…</p>
                          ) : plannerMessages.length === 0 ? (
                            <p className="py-6 text-center text-xs font-semibold text-slate-500">Noch keine Nachrichten.</p>
                          ) : plannerMessages.map((msg) => {
                            const displayMessage = (msg.message || '').replace(/^📅\s*/u, '');
                            const isPlannerNotice = /^Neuer Termin:/i.test(displayMessage.trim());
                            return (
                            <div
                              key={msg.id}
                              className={`rounded-xl border px-3 py-2 shadow-sm ${
                                isPlannerNotice
                                  ? 'border-emerald-200 bg-emerald-50/95'
                                  : msg.senderId === user.id
                                    ? 'border-orange-200 bg-orange-50/90'
                                    : 'border-slate-200 bg-white'
                              }`}
                            >
                              <div className="mb-1 flex items-center justify-between gap-2">
                                <div className="inline-flex items-center gap-2">
                                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-900 text-[10px] font-black text-white">
                                    {(msg.senderLabel || 'R').slice(0, 1).toUpperCase()}
                                  </span>
                                  <span className="text-[11px] font-black text-slate-700">{msg.senderLabel}</span>
                                </div>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  {new Date(msg.createdAt).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}
                                </span>
                              </div>
                              <p className={`whitespace-pre-wrap break-words text-xs leading-relaxed ${isPlannerNotice ? 'text-emerald-900 font-semibold' : 'text-slate-700'}`}>
                                {displayMessage}
                              </p>
                            </div>
                          );
                          })}
                        </div>
                        <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                          <Textarea
                            value={plannerMessageDraft}
                            onChange={(e) => setPlannerMessageDraft(e.target.value)}
                            placeholder="Nachricht an alle Recruiter…"
                            rows={5}
                          />
                          <div className="mt-2 flex justify-end">
                            <Button
                              type="button"
                              variant="primary"
                              className="h-10 text-xs font-black uppercase tracking-wide"
                              isLoading={plannerMessageSending}
                              disabled={!plannerMessageDraft.trim() || plannerMessageSending}
                              onClick={() => void handleSendPlannerMessage()}
                            >
                              Nachricht senden
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          ) : activeView === 'external' ? (
            <div className="overflow-hidden rounded-2xl border border-[#1b2a47] bg-[#101B31] shadow-sm">
              <div className="border-b border-[#1b2a47] bg-[#101B31] px-4 py-3">
                <h3 className="text-sm font-black uppercase tracking-widest text-white">Kandidaten hinzufügen</h3>
                <p className="mt-1 text-xs font-medium text-white/90">
                  Manuell Daten erfassen und optional direkt im Marktplatz freigeben. Vor- und Nachname sind nur intern sichtbar – Kunden sehen auf dem Marktplatz einen{' '}
                  <span className="font-bold text-orange-200">Codenamen</span> (z. B. TX042), nie den echten Namen.
                </p>
              </div>
              <div className="space-y-4 px-4 py-4">
                {externalError && <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">{externalError}</div>}
                {externalSuccess && <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">{externalSuccess}</div>}
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input
                    label="Vorname (intern)"
                    labelClassName="text-white"
                    className="!bg-white !text-black placeholder:!text-slate-500"
                    value={externalForm.firstName}
                    onChange={(e) => setExternalForm((p) => ({ ...p, firstName: e.target.value }))}
                    placeholder="z. B. Max"
                  />
                  <Input
                    label="Nachname (intern)"
                    labelClassName="text-white"
                    className="!bg-white !text-black placeholder:!text-slate-500"
                    value={externalForm.lastName}
                    onChange={(e) => setExternalForm((p) => ({ ...p, lastName: e.target.value }))}
                    placeholder="z. B. Mustermann"
                  />
                  <Input label="Stadt" labelClassName="text-white" value={externalForm.city} onChange={(e) => setExternalForm((p) => ({ ...p, city: e.target.value }))} placeholder="Berlin" />
                  <Input label="Land" labelClassName="text-white" value={externalForm.country} onChange={(e) => setExternalForm((p) => ({ ...p, country: e.target.value }))} placeholder="Deutschland" />
                  <Select label="Branche" labelClassName="text-white" value={externalForm.industry} onChange={(e) => setExternalForm((p) => ({ ...p, industry: e.target.value }))}>
                    {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
                  </Select>
                  <Input
                    label="Beruf"
                    labelClassName="text-white"
                    className="!bg-white !text-black placeholder:!text-slate-500"
                    value={externalForm.profession}
                    onChange={(e) => setExternalForm((p) => ({ ...p, profession: e.target.value }))}
                    placeholder="z. B. Elektroniker, Projektleiter …"
                  />
                  <Input
                    label="Erfahrung (Jahre)"
                    labelClassName="text-white"
                    type="number"
                    min="0"
                    value={externalForm.experienceYears}
                    onChange={(e) =>
                      setExternalForm((p) => ({
                        ...p,
                        experienceYears:
                          e.target.value === '' ? '' : Math.max(0, Number(e.target.value)).toString(),
                      }))
                    }
                  />
                  <Input
                    label="Wunschgehalt (EUR)"
                    labelClassName="text-white"
                    type="number"
                    min="0"
                    value={externalForm.salaryWishEur}
                    onChange={(e) =>
                      setExternalForm((p) => ({
                        ...p,
                        salaryWishEur:
                          e.target.value === '' ? '' : Math.max(0, Number(e.target.value)).toString(),
                      }))
                    }
                    placeholder="z.B. 50000"
                  />
                  <Select label="Verfügbarkeit" labelClassName="text-white" value={externalForm.availability} onChange={(e) => setExternalForm((p) => ({ ...p, availability: e.target.value }))}>
                    {AVAILABILITY_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </Select>
                  <Select
                    label="Arbeitsumkreis"
                    labelClassName="text-white"
                    value={externalForm.workUmkreis}
                    onChange={(e) => setExternalForm((p) => ({ ...p, workUmkreis: e.target.value }))}
                  >
                    {WORK_UMKREIS_OPTIONS.map((w) => (
                      <option key={w} value={w}>
                        {w === '+25' || w === '+50' || w === '+100' || w === '+150' || w === '+200' || w === '+300' ? `${w} km` : w}
                      </option>
                    ))}
                  </Select>
                  <div className="md:col-span-2">
                    <Input
                      label="Sprachen"
                      labelClassName="text-white"
                      className="!bg-white !text-black placeholder:!text-slate-500"
                      value={externalForm.languagesRaw}
                      onChange={(e) => setExternalForm((p) => ({ ...p, languagesRaw: e.target.value }))}
                      placeholder="z. B. Deutsch (Muttersprache), Englisch (C1), Türkisch …"
                    />
                  </div>
                </div>
                <Input
                  label="Skills"
                  labelClassName="text-white"
                  className="!bg-white !text-black placeholder:!text-slate-500"
                  value={externalForm.skillsRaw}
                  onChange={(e) => setExternalForm((p) => ({ ...p, skillsRaw: e.target.value }))}
                />
                <Textarea
                  label="Über den Kandidaten (optional)"
                  labelClassName="text-white"
                  className="!bg-white !text-black placeholder:!text-slate-500"
                  value={externalForm.about}
                  onChange={(e) => setExternalForm((p) => ({ ...p, about: e.target.value }))}
                />
                <div className={`rounded-xl p-3 sm:p-4 ${COPPER_PANEL}`}>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.35em] text-white/40">Keywords auswählen</p>
                  <div className="space-y-3">
                    {BOOSTER_KEYWORD_CATEGORIES.map((cat) => (
                      <div key={cat.title}>
                        <p className="mb-1 text-xs font-black text-white/90">{cat.title}</p>
                        <div className="flex flex-wrap gap-2">
                          {cat.keywords.map((kw) => {
                            const active = externalBoostedKeywords.includes(kw);
                            return (
                              <button
                                key={`${cat.title}-${kw}`}
                                type="button"
                                onClick={() => toggleExternalKeyword(kw)}
                                className={`rounded-lg px-2.5 py-1 text-[10px] font-black uppercase tracking-wide transition-colors ${
                                  active
                                    ? 'border border-orange-500/50 bg-gradient-to-b from-orange-500/25 to-orange-600/10 text-white shadow-[0_0_16px_-4px_rgba(234,88,12,0.45)] ring-1 ring-orange-400/30'
                                    : 'border border-white/[0.07] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06] hover:text-white'
                                }`}
                              >
                                {kw}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <FileUpload
                    label="Lebenslauf (Pflicht)"
                    required
                    accept="application/pdf"
                    darkSurface
                    onChange={handleExternalCvUpload}
                    files={externalDocs.cvPdf ? [{ name: externalDocs.cvPdf.name }] : []}
                    onRemove={() => setExternalDocs((prev) => ({ ...prev, cvPdf: undefined }))}
                    helperText="PDF, max 10MB"
                  />
                  <FileUpload
                    label="Qualifikationen (Pflicht)"
                    required
                    accept="application/pdf"
                    multiple
                    darkSurface
                    onChange={handleExternalQualificationsUpload}
                    files={externalDocs.qualifications}
                    onRemove={(idx) => setExternalDocs((prev) => ({ ...prev, qualifications: prev.qualifications.filter((_, i) => i !== idx) }))}
                    helperText="Mind. 1 PDF"
                  />
                  <FileUpload
                    label="Zertifikate (optional)"
                    accept="application/pdf"
                    multiple
                    darkSurface
                    onChange={handleExternalCertificatesUpload}
                    files={externalDocs.certificates}
                    onRemove={(idx) => setExternalDocs((prev) => ({ ...prev, certificates: prev.certificates.filter((_, i) => i !== idx) }))}
                    helperText="Optional"
                  />
                </div>
                <Button variant="primary" className="h-10 text-xs font-black !bg-slate-900 !text-white hover:!bg-slate-800" isLoading={isCreatingExternal} onClick={handleCreateExternalCandidate}>
                  Kandidat freigeben
                </Button>
              </div>
            </div>
          ) : activeView === 'matching' ? (
            <div className="overflow-x-clip rounded-3xl border border-slate-200/90 bg-white shadow-[0_8px_40px_-12px_rgba(15,23,42,0.12)]">
              <div className="relative overflow-x-clip border-b border-white/10 bg-gradient-to-br from-slate-900 via-[#0f172a] to-slate-950 px-4 py-4 sm:px-8 sm:py-8">
                <div className="pointer-events-none absolute -right-16 -top-24 h-48 w-48 rounded-full bg-orange-500/15 blur-3xl" aria-hidden />
                <div className="pointer-events-none absolute -bottom-20 -left-10 h-40 w-40 rounded-full bg-violet-500/10 blur-3xl" aria-hidden />
                <div className="relative">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-orange-400/95">Intelligente Zuordnung</p>
                  <h2 className="mt-2 text-xl font-bold tracking-tight text-white sm:text-2xl">KI-Matching</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
                    Passende Kandidaten werden zu offenen Rollen und Kundenanforderungen vorgeschlagen.
                  </p>
                </div>
              </div>
              <div className="space-y-5 p-4 sm:p-6">
                <Textarea
                  label="Rolle oder Anforderung"
                  labelClassName="text-slate-800"
                  className="min-h-[120px] border-slate-200 bg-white text-slate-900 placeholder:text-slate-400"
                  value={matchingRoleBrief}
                  onChange={(e) => setMatchingRoleBrief(e.target.value)}
                  placeholder="z. B. Senior Entwickler React/TypeScript, Automotive, remote möglich, Englisch fließend…"
                  rows={5}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="button" variant="primary" className="h-11 text-xs font-black sm:h-10" onClick={runMatchingSearch}>
                    Passende Talente vorschlagen
                  </Button>
                  <Button type="button" variant="secondary" className="h-11 text-xs font-bold sm:h-10" onClick={() => setActiveView('inquiries')}>
                    Zu externen Interessen
                  </Button>
                </div>
              </div>
              {matchingQuery !== null && (
                <div className="border-t border-slate-200 bg-slate-50/50 px-4 py-5 sm:px-6">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-800">Trefferliste</h3>
                  <p className="mt-1 text-xs font-medium text-slate-500">
                    Sortierung nach Relevanz zur Anforderung (Score). Klick öffnet das Profil.
                  </p>
                  {matchingRankedResults.length === 0 ? (
                    <div className="mt-4">
                      <EmptyState
                        title={matchingQuery.trim() ? 'Keine passenden Profile' : 'Anforderung fehlt'}
                        description={
                          matchingQuery.trim()
                            ? 'Formulieren Sie konkrete Skills, Branchen oder Orte – oder wechseln Sie zur Talents-Ansicht.'
                            : 'Geben Sie oben eine Rolle oder Anforderung ein und starten Sie die Vorschläge erneut.'
                        }
                      />
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
                      {matchingRankedResults.map(({ candidate: c, score }) => {
                        const name = `${c.firstName} ${c.lastName}`.trim() || c.candidateNumber || 'Kandidat';
                        return (
                          <li key={c.userId} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900">{name}</p>
                              <p className="mt-0.5 text-xs font-medium text-slate-600">
                                {displayProfession(c)} · {c.industry}
                                {c.city ? ` · ${c.city}` : ''}
                              </p>
                              {c.skills?.length ? (
                                <p className="mt-1 line-clamp-2 text-[11px] text-slate-500">{c.skills.slice(0, 8).join(' · ')}</p>
                              ) : null}
                            </div>
                            <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-end">
                              <Badge variant="slate">Score {score}</Badge>
                              <Button type="button" size="sm" variant="primary" className="h-9 text-[11px] font-black" onClick={() => void handleViewCandidate(c)}>
                                Profil öffnen
                              </Button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
            </div>
          ) : activeView === 'users' ? (
            <div className="overflow-hidden rounded-2xl border border-orange-200/40 bg-[#101B31] shadow-sm">
              <div
                className={`relative flex flex-col gap-2 border-b border-orange-500/25 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between ${COPPER_PANEL}`}
              >
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Alle Nutzer</h3>
                  <p className="mt-0.5 text-xs font-medium text-white/65">
                    Kandidaten: Marktplatz sichtbar, Formularstatus und zuletzt online.
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-col leading-tight">
                    <div className="text-3xl font-black text-white">
                      {loadingRegisteredUsers ? '…' : registeredUsers.length}
                    </div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-white/45">Nutzer gesamt</div>
                  </div>
                  <Badge variant="green">Aktuell sichtbar {filteredCandidateSubmittedCount}</Badge>
                  <Badge variant="yellow">Formular offen {filteredCandidateOpenCount}</Badge>
                  {filteredOtherRolesCount > 0 && <Badge variant="slate">Sonstige {filteredOtherRolesCount}</Badge>}
                  {filteredRegisteredUsers.length !== registeredUsers.length && (
                    <span className="text-[10px] font-bold text-white/50">
                      {filteredRegisteredUsers.length} nach Filter
                    </span>
                  )}
                </div>
              </div>
              {registeredUsersError && (
                <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  {registeredUsersError}
                </div>
              )}
              {registeredUsersSuccess && (
                <div className="mx-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
                  {registeredUsersSuccess}
                </div>
              )}
              {loadingRegisteredUsers && registeredUsers.length === 0 ? (
                <div className="flex h-40 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-orange-500" />
                </div>
              ) : filteredRegisteredUsers.length === 0 ? (
                <div className="px-4 py-8 text-center text-xs font-medium text-slate-300">
                  {registeredUsers.length === 0 ? 'Keine Nutzer gefunden.' : 'Keine Treffer für die Suche.'}
                </div>
              ) : (
                <>
                  <div className="divide-y divide-slate-100 lg:hidden">
                    {filteredRegisteredUsers.map((u) => {
                      const displayName = `${u.firstName} ${u.lastName}`.trim() || u.email;
                      const isSelf = u.id === user.id;
                      const effRole = effectiveRegisteredUserRole(u);
                      const isRecruiterAccount = effRole === UserRole.RECRUITER || effRole === UserRole.ADMIN;
                      return (
                        <div
                          key={u.id}
                          className={`space-y-2 px-4 py-4 ${isRecruiterAccount ? 'border-l-4 border-orange-500 bg-orange-500/10' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-black text-slate-100">{displayName}</p>
                              <p className="truncate text-xs font-semibold text-slate-300">{u.email}</p>
                              {isRecruiterAccount && (
                                <p className="mt-1 text-[11px] font-black uppercase tracking-wider text-orange-300">
                                  {roleLabelDe(effRole)}
                                </p>
                              )}
                            </div>
                            {effRole === UserRole.CANDIDATE && (
                              <Badge variant="slate">{roleLabelDe(effRole)}</Badge>
                            )}
                          </div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            Registriert: {new Date(u.createdAt).toLocaleString('de-DE')}
                          </p>
                          {effRole === UserRole.CANDIDATE && (
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {u.isPublished ? (
                                <Badge variant="green">Marktplatz sichtbar</Badge>
                              ) : (
                                <Badge variant="red">Nicht im Marktplatz</Badge>
                              )}
                              {u.isSubmitted ? <Badge variant="slate">Formular eingereicht</Badge> : null}
                            </div>
                          )}
                          <p className="mt-2 text-xs font-semibold text-slate-200">
                            Zuletzt online: {inactivityDurationDe(u.lastSeenAt)}
                          </p>
                          {effRole === UserRole.CANDIDATE && u.isPublished && !isSelf && (
                            <Button
                              type="button"
                              size="sm"
                              variant="primary"
                              className="h-9 w-full !bg-amber-600 !text-[11px] font-black !text-white hover:!bg-amber-500"
                              isLoading={unpublishingUserId === u.id}
                              disabled={unpublishingUserId === u.id}
                              onClick={() => void handleUnpublishRegisteredCandidate(u)}
                            >
                              Vom Marktplatz entfernen
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            className="h-9 w-full text-[11px] font-black"
                            disabled={isSelf || deletingUserId === u.id}
                            title={isSelf ? 'Eigenes Konto kann hier nicht gelöscht werden.' : undefined}
                            onClick={() => setUserDeleteTarget(u)}
                          >
                            {deletingUserId === u.id ? 'Wird gelöscht…' : 'Nutzer löschen'}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden overflow-x-auto lg:block">
                    <table className="w-full min-w-[800px] text-left">
                      <thead className="border-b border-slate-800 bg-[#101B31]">
                        <tr>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300">Name / E-Mail</th>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300">Rolle</th>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300">Registriert am</th>
                          <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-300">Zuletzt online</th>
                          <th className="px-4 py-3 text-right text-[10px] font-black uppercase tracking-widest text-slate-300">Aktion</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {filteredRegisteredUsers.map((u) => {
                          const displayName = `${u.firstName} ${u.lastName}`.trim() || '—';
                          const isSelf = u.id === user.id;
                          const effRole = effectiveRegisteredUserRole(u);
                          const isRecruiterAccount = effRole === UserRole.RECRUITER || effRole === UserRole.ADMIN;
                          return (
                            <tr
                              key={u.id}
                              className={`transition-colors hover:bg-white/5 ${isRecruiterAccount ? 'bg-orange-500/10' : ''}`}
                            >
                              <td className={`px-4 py-3 ${isRecruiterAccount ? 'border-l-4 border-orange-500' : ''}`}>
                                <div className="text-sm font-bold text-slate-100">{displayName}</div>
                                <div className="text-[11px] font-semibold text-slate-300">{u.email}</div>
                                {effRole === UserRole.CANDIDATE && (
                                  <div className="mt-2 flex flex-wrap items-center gap-2">
                                    {u.isPublished ? (
                                      <Badge variant="green">Marktplatz sichtbar</Badge>
                                    ) : (
                                      <Badge variant="red">Nicht im Marktplatz</Badge>
                                    )}
                                    {u.isSubmitted ? <Badge variant="slate">Formular eingereicht</Badge> : null}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={effRole === UserRole.CANDIDATE ? 'slate' : effRole === UserRole.ADMIN ? 'orange' : 'dark'}>
                                  {roleLabelDe(effRole)}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-200">
                                {new Date(u.createdAt).toLocaleString('de-DE')}
                              </td>
                              <td className="px-4 py-3 text-xs font-semibold text-slate-200">{inactivityDurationDe(u.lastSeenAt)}</td>
                              <td className="px-4 py-3 text-right">
                                <div className="flex flex-col items-end gap-2 sm:flex-row sm:justify-end">
                                  {effRole === UserRole.CANDIDATE && u.isPublished && !isSelf && (
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="primary"
                                      className="h-9 !text-[10px] font-black !bg-amber-600 hover:!bg-amber-500"
                                      isLoading={unpublishingUserId === u.id}
                                      disabled={unpublishingUserId === u.id}
                                      onClick={() => void handleUnpublishRegisteredCandidate(u)}
                                    >
                                      Vom Marktplatz entfernen
                                    </Button>
                                  )}
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="danger"
                                    className="h-9 text-[10px] font-black"
                                    disabled={isSelf || deletingUserId === u.id}
                                    title={isSelf ? 'Eigenes Konto nicht löschbar' : undefined}
                                    onClick={() => setUserDeleteTarget(u)}
                                  >
                                    Löschen
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          ) : null}

          {activeView === 'calculator' && (
            <div className="overflow-hidden rounded-2xl">
              <HourlyRateCalculator />
            </div>
          )}

          {activeView === 'talents' && (
            <>
              {claimError && (
                <div className="mb-4 flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[11px] font-bold text-red-800 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="min-w-0">{claimError}</span>
                  <button type="button" className="shrink-0 self-end text-[10px] font-black uppercase tracking-wide text-red-600 underline sm:self-auto" onClick={() => setClaimError(null)}>
                    Schließen
                  </button>
                </div>
              )}
              {isInitialLoading && filtered.length === 0 ? (
                <div className="flex h-40 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-orange-600" />
                </div>
              ) : filtered.length === 0 ? (
                <EmptyState
                  title={onlyStaleUnedited ? 'Keine Treffer für diesen Filter' : 'Keine Kandidaten'}
                  description={
                    onlyStaleUnedited
                      ? 'Keine Kandidaten, bei denen die letzte Bearbeitung mindestens 3 Tage her ist – oder die Suche schließt alle aus.'
                      : 'Nichts gefunden.'
                  }
                />
              ) : (
                <div className="space-y-8">
                <div className="-mt-2 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="mb-1 text-center text-[11px] font-bold text-slate-500 sm:mb-0 sm:text-left">
                    {industryGroups.length} {industryGroups.length === 1 ? 'Branche' : 'Branchen'} · {filtered.length}{' '}
                    {filtered.length === 1 ? 'Kandidat' : 'Kandidaten'}
                  </p>
                  <label className="flex cursor-pointer select-none items-center gap-2 self-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-bold text-slate-800 shadow-sm ring-1 ring-slate-900/5 sm:self-auto">
                    <input
                      type="checkbox"
                      className="h-4 w-4 shrink-0 rounded border-slate-300 text-orange-600 focus:ring-orange-500"
                      checked={onlyStaleUnedited}
                      onChange={(e) => setOnlyStaleUnedited(e.target.checked)}
                    />
                    <span className="leading-snug">Nur ohne Bearbeitung seit 3+ Tagen</span>
                  </label>
                </div>
                {industryGroups.map(({ industry, candidates }) => (
                  <section
                    key={industry}
                    className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)]"
                  >
                    <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-4 py-3 text-white sm:px-5 sm:py-4">
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
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-200 ring-1 ring-white/10">
                          {candidates.length} {candidates.length === 1 ? 'Talent' : 'Talente'}
                        </span>
                      </div>
                    </div>

                    {/* Mobil: Karten statt Tabelle (kein horizontales Scroll-Chaos) */}
                    <div className="divide-y divide-slate-100 lg:hidden">
                      {candidates.map((cand) => (
                        <div key={cand.userId} className="space-y-3 px-4 py-4">
                          <div className="flex gap-3">
                            {isStaleNeedsReview(cand) ? (
                              <StaleNeedsAttentionIcon title="Bearbeiten nötig: seit 3+ Tagen offen" />
                            ) : null}
                            <Avatar seed={cand.firstName + cand.lastName} size="sm" imageUrl={cand.profileImageUrl} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-slate-900">
                                {`${cand.firstName || ''} ${cand.lastName || ''}`.trim() || cand.candidateNumber || 'Unbekannter Kandidat'}
                              </p>
                              <p className="text-xs font-semibold text-slate-500">
                                {[
                                  cand.city?.trim(),
                                  `${cand.experienceYears} J. Erfahrung`,
                                  displaySalaryWish(cand) !== '-' ? displaySalaryWish(cand) : null,
                                ]
                                  .filter(Boolean)
                                  .join(' · ')}
                              </p>
                              {candidateReviewHint(cand).mobileText ? (
                                <p className={`mt-1 text-[10px] font-black uppercase tracking-wider ${candidateReviewHint(cand).className.includes('red-700') ? 'text-red-700' : candidateReviewHint(cand).className.includes('emerald-700') ? 'text-emerald-700' : 'text-amber-700'}`}>
                                  {candidateReviewHint(cand).mobileText}
                                </p>
                              ) : null}
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                {statusBadgeBlock(cand)}
                                <Badge variant={cand.isPublished ? 'green' : 'slate'}>
                                  Live: {cand.isPublished ? 'Ja' : 'Nein'}
                                </Badge>
                              </div>
                            </div>
                          </div>
                          <div className="space-y-2 border-t border-slate-100 pt-3">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Team / Bearbeitung</p>
                            {renderTeamControls(cand, true)}
                          </div>
                          <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Aktionen</p>
                            {renderPublishAndManage(cand, true)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="hidden overflow-x-auto lg:block">
                      <table className="w-full min-w-[720px] text-left">
                        <thead className="border-b border-slate-700 bg-slate-900">
                          <tr>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">Name</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">Beruf</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">Exp</th>
                            <th className="px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">Wunsch Gehalt</th>
                            <th className="min-w-[150px] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white">
                              Team
                              <span className="mt-0.5 block font-bold normal-case tracking-normal text-[9px] text-slate-300">Wer bearbeitet?</span>
                            </th>
                            <th className="px-5 py-3 text-right text-[10px] font-black uppercase tracking-widest text-white">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {candidates.map((cand) => (
                            <tr key={cand.userId} className="transition-colors hover:bg-slate-50/80">
                              <td className="px-5 py-3">
                                <div className="flex items-center gap-3">
                                  {isStaleNeedsReview(cand) ? (
                                    <StaleNeedsAttentionIcon title="Bearbeiten nötig: seit 3+ Tagen offen" />
                                  ) : null}
                                  <Avatar seed={cand.firstName + cand.lastName} size="sm" imageUrl={cand.profileImageUrl} />
                                  <div>
                                    <div className="text-sm font-bold text-slate-900">
                                      {`${cand.firstName || ''} ${cand.lastName || ''}`.trim() || cand.candidateNumber || 'Unbekannter Kandidat'}
                                    </div>
                                    <div className="text-[10px] font-bold uppercase text-slate-400">{cand.city}</div>
                                    {candidateReviewHint(cand).mobileText ? (
                                      <p
                                        className={`mt-1 max-w-[min(100%,280px)] text-[9px] font-black uppercase leading-snug tracking-wide ${candidateReviewHint(cand).className.includes('red-700') ? 'text-red-700' : candidateReviewHint(cand).className.includes('emerald-700') ? 'text-emerald-700' : 'text-amber-700'}`}
                                      >
                                        {candidateReviewHint(cand).mobileText}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                              <td className="px-5 py-3 text-xs font-semibold text-slate-700">
                                {displayProfession(cand)}
                              </td>
                              <td className="px-5 py-3 text-xs font-semibold text-slate-600">{cand.experienceYears}J</td>
                              <td className="px-5 py-3 text-xs font-semibold text-slate-700">{displaySalaryWish(cand)}</td>
                              <td className="align-top px-5 py-3">{renderTeamControls(cand, false)}</td>
                              <td className="px-5 py-3 text-right">{renderPublishAndManage(cand, false)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
                </div>
              )}
            </>
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
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-xl border px-4 py-3 text-xs font-bold ${mine ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-slate-700 bg-slate-900 text-slate-100 shadow-[0_14px_34px_-22px_rgba(15,23,42,0.9)]'}`}
                  >
                    <span>
                      {mine
                        ? 'Sie sind für andere als Bearbeiter eingetragen. Der Status bleibt, bis Sie „Fertig – freigeben“ wählen (auch nach Schließen dieses Fensters).'
                        : `${e.label} bearbeitet diesen Kandidaten aktuell (Team-Sicht). Bitte nicht parallel am gleichen Profil arbeiten.`}
                    </span>
                    {mine && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-[10px] font-black shrink-0"
                        disabled={busy}
                        onClick={() => void handleRecruiterEditingClaim(selectedCandidate)}
                      >
                        Fertig – freigeben
                      </Button>
                    )}
                  </div>
                );
              })()}
              {/* Header */}
              <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-2xl text-white">
                <Avatar seed={selectedCandidate.candidateNumber || selectedCandidate.firstName} size="md" imageUrl={selectedCandidate.profileImageUrl} />
                <div className="flex-1 leading-tight">
                  <h3 className="text-lg font-black">
                    {`${selectedCandidate.firstName || ''} ${selectedCandidate.lastName || ''}`.trim() || selectedCandidate.candidateNumber || 'Unbekannter Kandidat'}
                  </h3>
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
                  tabs={[
                    { id: 'profile', label: 'Profil' },
                    { id: 'documents', label: 'Dokumente' },
                    { id: 'edited-documents', label: 'Bearbeitete Dokumente' },
                  ]}
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
                            <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Beruf</p>
                            <p className="font-medium text-slate-700 text-sm">
                              {displayProfession(selectedCandidate)}
                            </p>
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
                          <p className="text-[10px] font-black text-slate-400 uppercase">Beruf</p>
                          <p className="text-sm font-bold text-slate-900">
                            {displayProfession(selectedCandidate)}
                          </p>
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
                          <p className="text-[10px] font-black text-slate-400 uppercase">Gehaltswunsch</p>
                          <p className="text-sm font-bold text-slate-900">
                            {displaySalaryWish(selectedCandidate)}
                          </p>
                        </div>
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase">Arbeitsradius</p>
                          <p className="text-sm font-bold text-slate-900">
                            {displayWorkRadius(selectedCandidate)}
                          </p>
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
                      {selectedCandidate.languages?.trim() && (
                        <div className="bg-slate-50 p-3 rounded-xl">
                          <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Sprachen</p>
                          <p className="text-sm text-slate-700 leading-relaxed">{selectedCandidate.languages}</p>
                        </div>
                      )}
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
                      {isLoadingDocs && (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
                          Dokumente werden geladen...
                        </div>
                      )}

                      {candidateDocs && (
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:items-start">
                          {/* Dokumente (download-only) */}
                          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Dokumente</h4>
                              <Badge variant="dark" className="text-[10px] py-0.5 px-2 bg-slate-800 text-white">Nur Download</Badge>
                            </div>

                            {/* CV */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Lebenslauf</h4>
                              {candidateDocs.original.cvPdf ? (
                                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                  <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{candidateDocs.original.cvPdf.name}</span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        if (selectedCandidate?.userId && !selectedCandidate.cvReviewedAt) {
                                          onAdminAction(selectedCandidate.userId, 'cv_reviewed', undefined, user.id);
                                        }
                                        setPreviewDoc(candidateDocs.original.cvPdf!);
                                      }}
                                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700"
                                    >
                                      Ansehen
                                    </button>
                                    <a href={candidateDocs.original.cvPdf.data} download={candidateDocs.original.cvPdf.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                      ↓
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="text-xs text-slate-400 italic">Kein CV</div>
                              )}
                            </div>

                            {/* Certificates */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Zertifikate</h4>
                              <div className="space-y-2">
                                {candidateDocs.original.certificates?.length ? (
                                  candidateDocs.original.certificates.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                      <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{doc.name}</span>
                                      <div className="flex gap-2">
                                        <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">
                                          Ansehen
                                        </button>
                                        <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                          ↓
                                        </a>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-slate-400 italic">Keine</div>
                                )}
                              </div>
                            </div>

                            {/* Qualifications */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Qualifikationen</h4>
                              <div className="space-y-2">
                                {candidateDocs.original.qualifications?.length ? (
                                  candidateDocs.original.qualifications.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                      <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{doc.name}</span>
                                      <div className="flex gap-2">
                                        <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">
                                          Ansehen
                                        </button>
                                        <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                          ↓
                                        </a>
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-xs text-slate-400 italic">Keine</div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bearbeitete Dokumente (Marktplatz-Version) - jetzt eigener Tab */}
                          {false && <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Bearbeitete Dokumente</h4>
                              <Badge variant="orange" className="text-[10px] py-0.5 px-2">Marktplatz-Version</Badge>
                            </div>

                            {/* CV */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Lebenslauf (Bearbeitet)</h4>
                              {candidateDocs.edited.cvPdf ? (
                                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                  <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{candidateDocs.edited.cvPdf.name}</span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setPreviewDoc(candidateDocs.edited.cvPdf!)}
                                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700"
                                    >
                                      Ansehen
                                    </button>
                                    <a href={candidateDocs.edited.cvPdf.data} download={candidateDocs.edited.cvPdf.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                      ↓
                                    </a>
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
                              ) : (
                                <div className="mt-2">
                                  <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                                    CV hochladen / ersetzen
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
                            </div>

                            {/* Certificates */}
                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Zertifikate (Bearbeitet)</h4>
                              <div className="space-y-2">
                                {candidateDocs.edited.certificates?.length ? (
                                  candidateDocs.edited.certificates.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                      <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{doc.name}</span>
                                      <div className="flex gap-2">
                                        <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">
                                          Ansehen
                                        </button>
                                        <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                          ↓
                                        </a>
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
                                  ))
                                ) : (
                                  <div className="text-xs text-slate-400 italic">Keine</div>
                                )}
                              </div>

                              <div className="mt-2">
                                <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                                  Zertifikate hinzufügen / ersetzen
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
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Qualifikationen (Bearbeitet)</h4>
                              <div className="space-y-2">
                                {candidateDocs.edited.qualifications?.length ? (
                                  candidateDocs.edited.qualifications.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                      <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{doc.name}</span>
                                      <div className="flex gap-2">
                                        <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">
                                          Ansehen
                                        </button>
                                        <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                          ↓
                                        </a>
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
                                  ))
                                ) : (
                                  <div className="text-xs text-slate-400 italic">Keine</div>
                                )}
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
                          </div>}
                        </div>
                      )}

                      {docError && <div className="text-[11px] font-black text-red-600">{docError}</div>}
                    </div>
                  )}

                  {modalTab === 'edited-documents' && (
                    <div className="space-y-4">
                      {isLoadingDocs && (
                        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                          <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-orange-500" />
                          Dokumente werden geladen...
                        </div>
                      )}

                      {candidateDocs && (
                        <div className="grid grid-cols-1 gap-4">
                          <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 space-y-4">
                            <div className="flex items-center justify-between gap-3">
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Bearbeitete Dokumente</h4>
                              <Badge variant="orange" className="text-[10px] py-0.5 px-2">Marktplatz-Version</Badge>
                            </div>

                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Lebenslauf (Bearbeitet)</h4>
                              {candidateDocs.edited.cvPdf ? (
                                <div className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                  <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{candidateDocs.edited.cvPdf.name}</span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setPreviewDoc(candidateDocs.edited.cvPdf!)}
                                      className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700"
                                    >
                                      Ansehen
                                    </button>
                                    <a href={candidateDocs.edited.cvPdf.data} download={candidateDocs.edited.cvPdf.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                      ↓
                                    </a>
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
                              ) : (
                                <div className="mt-2">
                                  <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                                    CV hochladen / ersetzen
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
                            </div>

                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Zertifikate (Bearbeitet)</h4>
                              <div className="space-y-2">
                                {candidateDocs.edited.certificates?.length ? (
                                  candidateDocs.edited.certificates.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                      <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{doc.name}</span>
                                      <div className="flex gap-2">
                                        <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">
                                          Ansehen
                                        </button>
                                        <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                          ↓
                                        </a>
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
                                  ))
                                ) : (
                                  <div className="text-xs text-slate-400 italic">Keine</div>
                                )}
                              </div>

                              <div className="mt-2">
                                <label className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-black ${isSavingDocs ? 'bg-slate-100 text-slate-400' : 'bg-slate-900 text-white hover:bg-slate-800'} cursor-pointer`}>
                                  Zertifikate hinzufügen / ersetzen
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

                            <div>
                              <h4 className="text-[10px] font-black text-slate-900 uppercase tracking-widest mb-2">Qualifikationen (Bearbeitet)</h4>
                              <div className="space-y-2">
                                {candidateDocs.edited.qualifications?.length ? (
                                  candidateDocs.edited.qualifications.map((doc, i) => (
                                    <div key={i} className="flex items-center justify-between p-3 border border-slate-200 rounded-xl bg-slate-50">
                                      <span className="text-sm font-bold text-slate-700 truncate max-w-[220px]">{doc.name}</span>
                                      <div className="flex gap-2">
                                        <button onClick={() => setPreviewDoc(doc)} className="px-3 py-1 bg-slate-200 hover:bg-slate-300 rounded-lg text-xs font-bold text-slate-700">
                                          Ansehen
                                        </button>
                                        <a href={doc.data} download={doc.name} className="px-3 py-1 bg-orange-100 hover:bg-orange-200 rounded-lg text-xs font-bold text-orange-700">
                                          ↓
                                        </a>
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
                                  ))
                                ) : (
                                  <div className="text-xs text-slate-400 italic">Keine</div>
                                )}
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
                        </div>
                      )}

                      {docError && <div className="text-[11px] font-black text-red-600">{docError}</div>}
                    </div>
                  )}

                </>
              )}
            </div>

            {/* FOOTER */}
            {!isEditing && <div className="pt-4 border-t border-slate-100 mt-4"><Button className="w-full" variant="outline" onClick={() => setSelectedCandidate(null)}>Schließen</Button></div>}
          </Modal>
        )}

        <Modal
          isOpen={!!userDeleteTarget}
          onClose={() => {
            if (deletingUserId) return;
            setUserDeleteTarget(null);
            setUserDeleteConfirmText('');
          }}
          title="Nutzer löschen?"
        >
          {userDeleteTarget && (
            <>
              <p className="text-sm leading-relaxed text-slate-700">
                Das Konto <strong className="text-slate-900">{userDeleteTarget.email}</strong> wird dauerhaft aus der Verwaltung entfernt (Profil und Dokumente werden wie beim Kandidaten-Löschen
                gesperrt). Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              {effectiveRegisteredUserRole(userDeleteTarget) !== UserRole.CANDIDATE && (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-900">
                  Hinweis: Recruiter- oder Admin-Konten sollten nur bei Bedarf gelöscht werden. Der Auth-Zugang in Supabase bleibt ggf. bestehen, bis er dort separat entfernt wird.
                </p>
              )}
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  Zur Bestätigung bitte <span className="font-black text-slate-900">löschen</span> eintippen.
                </p>
                <Input
                  value={userDeleteConfirmText}
                  onChange={(e) => setUserDeleteConfirmText(e.target.value)}
                  placeholder='löschen'
                  autoComplete="off"
                  className="h-10 bg-white"
                />
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!!deletingUserId}
                  onClick={() => {
                    setUserDeleteTarget(null);
                    setUserDeleteConfirmText('');
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="w-full sm:w-auto"
                  isLoading={!!deletingUserId}
                  disabled={!!deletingUserId || userDeleteConfirmText.trim().toLowerCase() !== 'löschen'}
                  onClick={() => void handleConfirmDeleteRegisteredUser()}
                >
                  Endgültig löschen
                </Button>
              </div>
            </>
          )}
        </Modal>

        <Modal
          isOpen={!!inquiryDeleteTarget}
          onClose={() => {
            if (deletingInquiryId) return;
            setInquiryDeleteTarget(null);
            setInquiryDeleteConfirmText('');
          }}
          title="Anfrage löschen?"
        >
          {inquiryDeleteTarget && (
            <>
              <p className="text-sm leading-relaxed text-slate-700">
                Die Anfrage von <strong className="text-slate-900">{inquiryDeleteTarget.contactName}</strong> wird dauerhaft gelöscht.
                Diese Aktion kann nicht rückgängig gemacht werden.
              </p>
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">
                  Zur Bestätigung bitte <span className="font-black text-slate-900">löschen</span> eintippen.
                </p>
                <Input
                  value={inquiryDeleteConfirmText}
                  onChange={(e) => setInquiryDeleteConfirmText(e.target.value)}
                  placeholder="löschen"
                  autoComplete="off"
                  className="h-10 bg-white"
                />
              </div>
              <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={!!deletingInquiryId}
                  onClick={() => {
                    setInquiryDeleteTarget(null);
                    setInquiryDeleteConfirmText('');
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  type="button"
                  variant="danger"
                  className="w-full sm:w-auto"
                  isLoading={!!deletingInquiryId}
                  disabled={!!deletingInquiryId || inquiryDeleteConfirmText.trim().toLowerCase() !== 'löschen'}
                  onClick={() => void handleDeleteInquiry(inquiryDeleteTarget)}
                >
                  Endgültig löschen
                </Button>
              </div>
            </>
          )}
        </Modal>

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
