
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

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#/');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [allCandidates, setAllCandidates] = useState<CandidateProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      // Ensure auth service is initialized (creates demo recruiters)
      await authService.ensureInit();

      const initialUser = authService.getCurrentUser();

      // If we have a user, validate against backend and get profile data
      if (initialUser) {
        if (initialUser.role === UserRole.CANDIDATE) {
          try {
            const profile = await candidateService.getById(initialUser.id);
            if (profile && profile.firstName) {
              setUser({ ...initialUser, firstName: profile.firstName });
            } else if (profile) {
              setUser(initialUser);
            } else {
              // Profil existiert nicht mehr im Backend – Session ungültig
              authService.logout();
            }
          } catch (e) {
            // Backend nicht erreichbar oder User existiert nicht – Session aufräumen
            console.warn('[App] Session validation failed, logging out:', e);
            authService.logout();
          }
        } else {
          setUser(initialUser);
        }
      }

      // Öffentliche Kandidatenliste für alle (auch ohne Login) – Zuschauer, Kunden, Interessenten
      const list = await candidateService.getAll();
      setAllCandidates(list);
      setIsLoading(false);
    };
    init();

    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentPath(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Marktplatz: öffentliche Kandidatenliste nachladen, wenn jemand direkt #/talents aufruft (Gäste/Zuschauer)
  useEffect(() => {
    if (!currentPath.startsWith('/talents')) return;
    const published = allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE);
    if (published.length === 0) {
      candidateService.getAll().then((list) => setAllCandidates(list));
    }
  }, [currentPath]);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleAuthSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);

    // If candidate, ensure they have a profile and it's in the list
    if (loggedInUser.role === UserRole.CANDIDATE) {
      let profile = await candidateService.getById(loggedInUser.id);
      if (!profile) {
        profile = await candidateService.createProfile(loggedInUser.id);
      }

      // Update user state with firstName from profile for Greeting
      if (profile && profile.firstName) {
        setUser({ ...loggedInUser, firstName: profile.firstName });
      }

      // Refresh list (getAll = nur veröffentlichte) und eigenes Profil drin behalten
      const list = await candidateService.getAll();
      setAllCandidates((prev) => {
        const withoutMe = list.filter((c) => c.userId !== loggedInUser.id);
        return profile ? [...withoutMe, profile] : withoutMe;
      });
    }
  };

  const handleUpdateCandidate = async (updated: CandidateProfile) => {
    try {
      const res = await candidateService.update(updated);
      setAllCandidates(prev => {
        const exists = prev.find(c => c.userId === res.userId);
        if (exists) {
          return prev.map(c => c.userId === res.userId ? res : c);
        } else {
          return [...prev, res];
        }
      });
      showToast('Profil erfolgreich gespeichert!');
    } catch (e: any) {
      showToast(e.message || 'Fehler beim Speichern', 'error');
    }
  };

  const handleAdminAction = async (userId: string, action: 'delete' | 'status', newStatus?: CandidateStatus, performerId?: string) => {
    await candidateService.adminAction(userId, action, newStatus, performerId || user?.id);
    // Always refresh full list for admin actions to ensure blocked users remain visible
    const list = await candidateService.getAllAdmin();
    setAllCandidates(list);
    showToast(action === 'delete' ? 'Kandidat erfolgreich entfernt.' : `Status auf "${newStatus}" aktualisiert.`);
  };

  const handleLogout = () => {
    authService.logout();
    setUser(null);
    navigate('/');
  };

  if (isLoading) return (
    <div className="h-screen flex items-center justify-center bg-[#fafafa]">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-slate-200 border-t-orange-600"></div>
    </div>
  );

  const renderRoute = () => {
    const path = currentPath.replace('#', '') || '/';

    if (path === '/') return <LandingPage onNavigate={navigate} user={user} />;

    if (path === '/candidate/auth') {
      if (user && user.role === UserRole.CANDIDATE) {
        navigate('/candidate/profile');
        return null;
      }
      return <CandidateAuth onAuthSuccess={async (u) => { await handleAuthSuccess(u); navigate('/candidate/profile'); }} />;
    }

    if (path === '/candidate/profile') {
      if (!user || user.role !== UserRole.CANDIDATE) {
        navigate('/candidate/auth');
        return null;
      }
      let profile = allCandidates.find(c => c.userId === user.id);
      if (!profile) {
        // Profil laden oder anlegen (z. B. nach Reload oder wenn Liste nur veröffentlichte enthält)
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

    // Marktplatz: für alle frei zugänglich (Zuschauer, Kunden, Interessenten) – kein Recruiter-Login nötig
    if (path === '/talents') return <TalentMarketplace candidates={allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE)} onNavigate={navigate} user={user} />;

    if (path.startsWith('/talents/')) {
      const id = path.split('/').pop();
      return <TalentMarketplace candidates={allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE)} selectedId={id} onNavigate={navigate} user={user} />;
    }

    if (path.startsWith('/verify-email')) {
      return <VerifyEmail onNavigate={navigate} />;
    }

    if (path === '/recruiter/auth') {
      if (user && (user.role === UserRole.RECRUITER || user.role === UserRole.ADMIN)) {
        navigate('/recruiter/dashboard');
        return null;
      }
      return <RecruiterAuth onAuthSuccess={(u) => { setUser(u); navigate('/recruiter/dashboard'); }} />;
    }

    if (path === '/recruiter/dashboard') {
      if (!user || (user.role !== UserRole.RECRUITER && user.role !== UserRole.ADMIN)) {
        navigate('/recruiter/auth');
        return null;
      }
      return <RecruiterDashboard user={user} candidates={allCandidates} onAdminAction={handleAdminAction} onUpdateCandidate={handleUpdateCandidate} onLogout={handleLogout} />;
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
