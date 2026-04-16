import React, { useState, useEffect } from 'react';
import { User, UserRole, CandidateProfile, CandidateStatus } from './types';
import { authService } from './services/AuthService';
import { candidateService } from './services/CandidateService';
import LandingPage from './pages/LandingPage';
import CandidateAuth from './pages/CandidateAuth';
import CandidateProfilePage from './pages/CandidateProfile';
import TalentMarketplace from './pages/TalentMarketplace';
import RecruiterAuth from './pages/RecruiterAuth';
import RecruiterDashboard from './pages/RecruiterDashboard';
import VerifyEmail from './pages/VerifyEmail';
import { Toast, Button } from './components/UI';

const RECRUITER_CANDIDATES_CACHE_KEY = 'cms_talents_recruiter_candidates_snapshot';

const resolveInitialPath = () => {
  if (window.location.pathname === '/verify-email') {
    return '/verify-email';
  }
  // Hash-Routing (#/talents): bevorzugt
  const rawHash = window.location.hash.slice(1);
  if (rawHash && rawHash !== '/') {
    const normalized = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
    return `#${normalized}`;
  }
  // Vercel/SPA: direkte Pfade ohne Hash (z. B. /talents) → gleiche Ansicht wie #/talents
  let pathname = window.location.pathname;
  if (pathname.endsWith('/') && pathname.length > 1) pathname = pathname.slice(0, -1);
  if (pathname && pathname !== '/' && pathname !== '/index.html') {
    return `#${pathname}${window.location.search}`;
  }
  return '#/';
};

/** Aktueller Routenpfad (ohne #), direkt aus der URL – vermeidet weiße Screens, wenn React-State kurz hinter dem Hash zurückliegt. */
function getRoutePathFromWindow(): string {
  if (window.location.pathname === '/verify-email') {
    return '/verify-email';
  }
  const rawHash = window.location.hash.slice(1);
  if (rawHash && rawHash !== '/') {
    const normalized = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
    return normalized.split('?')[0];
  }
  let pathname = window.location.pathname;
  if (pathname.endsWith('/') && pathname.length > 1) pathname = pathname.slice(0, -1);
  if (pathname && pathname !== '/' && pathname !== '/index.html') {
    return pathname.split('?')[0];
  }
  return '/';
}

const RoutePending: React.FC = () => (
  <div className="flex min-h-screen flex-col items-center justify-center bg-[#fafafa] px-6">
    <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-orange-600" aria-hidden />
    <p className="mt-4 text-sm font-medium text-slate-600">Weiterleitung…</p>
  </div>
);

function readRecruiterCandidatesCache(): CandidateProfile[] {
  try {
    const raw = window.localStorage.getItem(RECRUITER_CANDIDATES_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeRecruiterCandidatesCache(list: CandidateProfile[]): void {
  try {
    window.localStorage.setItem(RECRUITER_CANDIDATES_CACHE_KEY, JSON.stringify(list.slice(0, 500)));
  } catch {
    // Cache ist nur fuer Sofortanzeige; Fehler ignorieren.
  }
}

async function loadPublicCandidatesWithRetry(): Promise<CandidateProfile[]> {
  let lastList: CandidateProfile[] = [];
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const list = await candidateService.getAll();
    if (list.length > 0) return list;
    lastList = list;
    await new Promise((resolve) => window.setTimeout(resolve, 300 * (attempt + 1)));
  }
  return lastList;
}

async function loadRecruiterCandidatesWithRetry(): Promise<CandidateProfile[]> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await candidateService.getAllAdmin();
    } catch (e) {
      lastError = e;
      await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Recruiter-Kandidaten konnten nicht geladen werden.');
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPath, setCurrentPath] = useState(resolveInitialPath());
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [allCandidates, setAllCandidates] = useState<CandidateProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecruiterCandidatesLoading, setIsRecruiterCandidatesLoading] = useState(false);
  const [isMarketplaceLoading, setIsMarketplaceLoading] = useState(false);

  useEffect(() => {
    const init = async () => {
      // Ensure auth service is initialized before reading session state.
      await authService.ensureInit();

      const initialUser = authService.getCurrentUser();
      const isInitialRecruiter =
        !!initialUser && (initialUser.role === UserRole.RECRUITER || initialUser.role === UserRole.ADMIN);

      // If we have a user, validate against Supabase and get profile data.
      if (initialUser) {
        if (initialUser.role === UserRole.CANDIDATE) {
          try {
            const profile = await candidateService.getById(initialUser.id);
            if (profile && profile.firstName) {
              setUser({ ...initialUser, firstName: profile.firstName });
            } else if (profile) {
              setUser(initialUser);
            } else {
              // Profile does not exist anymore in Supabase. Session is invalid.
              authService.logout();
            }
          } catch (e) {
            // Supabase is not reachable or the user does not exist.
            console.warn('[App] Session validation failed, logging out:', e);
            authService.logout();
          }
        } else {
          setUser(initialUser);
        }
      }

      if (isInitialRecruiter) {
        const cached = readRecruiterCandidatesCache();
        if (cached.length > 0) setAllCandidates(cached);
      }

      // Show UI immediately; load public candidate list in the background.
      setIsLoading(false);
      const loadInitialCandidates = async () => {
        try {
          if (isInitialRecruiter) {
            const hasCachedCandidates = readRecruiterCandidatesCache().length > 0;
            setIsRecruiterCandidatesLoading(!hasCachedCandidates);
            const list = await loadRecruiterCandidatesWithRetry();
            writeRecruiterCandidatesCache(list);
            setAllCandidates(list);
          } else {
            setIsMarketplaceLoading(true);
            const list = await loadPublicCandidatesWithRetry();
            setAllCandidates(list);
          }
        } catch {
          setAllCandidates([]);
        } finally {
          setIsRecruiterCandidatesLoading(false);
          setIsMarketplaceLoading(false);
        }
      };
      loadInitialCandidates();
    };

    init();

    const handleLocationChange = () => {
      if (window.location.pathname === '/verify-email') {
        setCurrentPath('/verify-email');
        return;
      }
      const rawHash = window.location.hash.slice(1);
      if (rawHash && rawHash !== '/') {
        const normalized = rawHash.startsWith('/') ? rawHash : `/${rawHash}`;
        setCurrentPath(`#${normalized}`);
        return;
      }
      let pathname = window.location.pathname;
      if (pathname.endsWith('/') && pathname.length > 1) pathname = pathname.slice(0, -1);
      if (pathname && pathname !== '/' && pathname !== '/index.html') {
        setCurrentPath(`#${pathname}${window.location.search}`);
        return;
      }
      setCurrentPath('#/');
    };

    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    return () => {
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, []);

  // Load public candidates again when someone opens the marketplace directly.
  useEffect(() => {
    const routePath = getRoutePathFromWindow();
    if (!routePath.startsWith('/talents')) return;
    if (user && (user.role === UserRole.RECRUITER || user.role === UserRole.ADMIN)) return;
    const published = allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE);
    if (published.length > 0) return;

    let cancelled = false;
    setIsMarketplaceLoading(true);
    loadPublicCandidatesWithRetry()
      .then((list) => {
        if (!cancelled) setAllCandidates(list);
      })
      .finally(() => {
        if (!cancelled) setIsMarketplaceLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [currentPath, user, allCandidates.length]);

  // Refresh recruiter dashboard periodically so deleted records disappear quickly.
  useEffect(() => {
    const path = getRoutePathFromWindow();
    const isRecruiterView = path === '/recruiter/dashboard';
    const canSeeAll = !!user && (user.role === UserRole.RECRUITER || user.role === UserRole.ADMIN);
    if (!isRecruiterView || !canSeeAll) return;

    let cancelled = false;
    const tick = async () => {
      try {
        const list = await loadRecruiterCandidatesWithRetry();
        if (!cancelled) {
          writeRecruiterCandidatesCache(list);
          setAllCandidates(list);
        }
      } catch {
        // ignore transient errors
      }
    };

    tick();
    const id = window.setInterval(tick, 10_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [currentPath, user]);

  // Client-Heartbeat: last_seen_at für „Inaktiv seit …“.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const touch = async () => {
      if (cancelled) return;
      await candidateService.touchLastSeen();
    };

    void touch();
    const id = window.setInterval(() => {
      void touch();
    }, 60_000);

    const onVisibility = () => {
      if (document.visibilityState === 'visible') void touch();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user]);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleAuthSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);
    // Aktivität sofort nach Login erfassen, damit "Zuletzt online" zeitnah korrekt ist.
    void candidateService.touchLastSeen();

    if (loggedInUser.role === UserRole.CANDIDATE) {
      let profile = await candidateService.getById(loggedInUser.id);
      if (!profile) {
        profile = await candidateService.createProfile(loggedInUser.id);
      }

      if (profile && profile.firstName) {
        setUser({ ...loggedInUser, firstName: profile.firstName });
      }

      const list = await candidateService.getAll();
      setAllCandidates((prev) => {
        const withoutMe = list.filter((c) => c.userId !== loggedInUser.id);
        return profile ? [...withoutMe, profile] : withoutMe;
      });
    } else if (loggedInUser.role === UserRole.RECRUITER || loggedInUser.role === UserRole.ADMIN) {
      setIsRecruiterCandidatesLoading(true);
      try {
        const list = await loadRecruiterCandidatesWithRetry();
        writeRecruiterCandidatesCache(list);
        setAllCandidates(list);
      } finally {
        setIsRecruiterCandidatesLoading(false);
      }
    }
  };

  const handleUpdateCandidate = async (updated: CandidateProfile) => {
    try {
      const prev = allCandidates.find((c) => c.userId === updated.userId);
      const wasMarketplaceLive =
        !!prev?.isPublished && prev?.status === CandidateStatus.ACTIVE;
      const res = await candidateService.update(updated);
      setAllCandidates((prevList) => {
        const exists = prevList.find((c) => c.userId === res.userId);
        if (exists) {
          return prevList.map((c) => (c.userId === res.userId ? res : c));
        }
        return [...prevList, res];
      });
      if (
        user?.role === UserRole.CANDIDATE &&
        wasMarketplaceLive &&
        !res.isPublished
      ) {
        showToast(
          'Profil ist nicht mehr auf dem Marktplatz. Bitte erneut „Zum Recruiter senden“, damit es wieder geprüft werden kann.'
        );
      } else {
        showToast('Profil erfolgreich gespeichert!');
      }
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Speichern', 'error');
    }
  };

  const handleAdminAction = async (
    userId: string,
    action: 'delete' | 'status' | 'publish' | 'unpublish' | 'cv_reviewed',
    newStatus?: CandidateStatus,
    performerId?: string
  ) => {
    await candidateService.adminAction(userId, action, newStatus, performerId || user?.id);
    const list = await loadRecruiterCandidatesWithRetry();
    writeRecruiterCandidatesCache(list);
    setAllCandidates(list);
    showToast(
      action === 'delete'
        ? 'Konto wurde entfernt.'
        : action === 'publish'
          ? 'Profil wurde veröffentlicht.'
          : action === 'unpublish'
            ? 'Kandidat ist nicht mehr im Marktplatz sichtbar.'
            : action === 'cv_reviewed'
              ? 'Lebenslauf als geprüft markiert.'
              : `Status auf "${newStatus}" aktualisiert.`
    );
  };

  const refreshCandidatesForRecruiter = async () => {
    const list = await loadRecruiterCandidatesWithRetry();
    writeRecruiterCandidatesCache(list);
    setAllCandidates(list);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#fafafa]">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-orange-600"></div>
      </div>
    );
  }

  const renderRoute = () => {
    const path = getRoutePathFromWindow();

    if (path === '/') return <LandingPage onNavigate={navigate} user={user} />;

    if (path === '/candidate/auth') {
      if (user && user.role === UserRole.CANDIDATE) {
        navigate('/candidate/profile');
        return <RoutePending />;
      }
      return <CandidateAuth onAuthSuccess={async (u) => { await handleAuthSuccess(u); navigate('/candidate/profile'); }} />;
    }

    if (path === '/candidate/profile') {
      if (!user || user.role !== UserRole.CANDIDATE) {
        navigate('/candidate/auth');
        return <RoutePending />;
      }
      const profile = allCandidates.find(c => c.userId === user.id);
      if (!profile) {
        candidateService.createProfile(user.id)
          .then((p) => {
            setAllCandidates((prev) => {
              const withoutMe = prev.filter((c) => c.userId !== user.id);
              return [...withoutMe, p];
            });
          })
          .catch((err) => {
            console.error('[App] createProfile failed:', err);
            showToast('Sitzung abgelaufen. Bitte erneut anmelden.', 'error');
            handleLogout();
          });

        return (
          <div className="h-screen flex items-center justify-center bg-[#fafafa]">
            <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-orange-600"></div>
          </div>
        );
      }
      return <CandidateProfilePage profile={profile} onNavigate={navigate} onSave={handleUpdateCandidate} onLogout={handleLogout} />;
    }

    if (path === '/talents') {
      return <TalentMarketplace candidates={allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE)} isLoading={isMarketplaceLoading} onNavigate={navigate} user={user} />;
    }

    if (path.startsWith('/talents/')) {
      const id = path.split('/').pop();
      return <TalentMarketplace candidates={allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE)} isLoading={isMarketplaceLoading} selectedId={id} onNavigate={navigate} user={user} />;
    }

    if (path.startsWith('/verify-email') || window.location.pathname === '/verify-email') {
      return <VerifyEmail onNavigate={navigate} />;
    }

    if (path === '/recruiter/auth') {
      if (user && (user.role === UserRole.RECRUITER || user.role === UserRole.ADMIN)) {
        navigate('/recruiter/dashboard');
        return <RoutePending />;
      }
      return (
        <RecruiterAuth
          onAuthSuccess={async (u) => {
            await handleAuthSuccess(u);
            navigate('/recruiter/dashboard');
          }}
        />
      );
    }

    if (path === '/recruiter/dashboard') {
      if (!user || (user.role !== UserRole.RECRUITER && user.role !== UserRole.ADMIN)) {
        navigate('/recruiter/auth');
        return <RoutePending />;
      }
      return (
        <RecruiterDashboard
          user={user}
          candidates={allCandidates}
          isInitialLoading={isRecruiterCandidatesLoading}
          onAdminAction={handleAdminAction}
          onUpdateCandidate={handleUpdateCandidate}
          onRefreshCandidates={refreshCandidatesForRecruiter}
          onLogout={handleLogout}
        />
      );
    }

    return (
      <div className="p-20 text-center bg-[#fafafa] min-h-screen flex flex-col items-center justify-center">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Seite nicht gefunden</h2>
        <p className="text-slate-600 mb-6">Die angeforderte Seite existiert nicht.</p>
        <Button size="lg" onClick={() => navigate('/')}>Zur Startseite</Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {renderRoute()}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
