
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
import { Toast, Button } from './components/UI';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [currentPath, setCurrentPath] = useState(window.location.hash || '#/');
  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' } | null>(null);
  const [allCandidates, setAllCandidates] = useState<CandidateProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        // Ensure auth service is initialized (creates demo recruiters)
        // We wrap this to ensure app loads even if backend is offline
        try {
          await authService.ensureInit();
        } catch (e) {
          console.warn("Auth check failed:", e);
        }

        const initialUser = authService.getCurrentUser();

        // If we have a user, try to get their latest profile data for the name
        if (initialUser) {
          if (initialUser.role === UserRole.CANDIDATE) {
            try {
              const profile = await candidateService.getById(initialUser.id);
              if (profile && profile.firstName) {
                setUser({ ...initialUser, firstName: profile.firstName });
              } else {
                setUser(initialUser);
              }
            } catch (e) {
              setUser(initialUser);
            }
          } else {
            // Recruiter/Admin - we might wanna set a default name or fetch from recruiter profile if it existed
            setUser(initialUser);
          }
        }

        const list = await candidateService.getAll();
        setAllCandidates(list);
      } catch (e) {
        console.error("Global Init Error (App.tsx):", e);
        showToast("Server nicht erreichbar. Offline-Modus.", "error");
      } finally {
        setIsLoading(false);
      }
    };
    init();

    const handleHashChange = () => {
      const hash = window.location.hash || '#/';
      setCurrentPath(hash);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const navigate = (path: string) => {
    window.location.hash = path;
  };

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const handleAuthSuccess = async (loggedInUser: User) => {
    setUser(loggedInUser);

    // If candidate, ensure they have a profile
    if (loggedInUser.role === UserRole.CANDIDATE) {
      let profile = await candidateService.getById(loggedInUser.id);
      if (!profile) {
        profile = await candidateService.createProfile(loggedInUser.id);
      }

      // Update user state with firstName from profile for Greeting
      if (profile && profile.firstName) {
        setUser({ ...loggedInUser, firstName: profile.firstName });
      }

      // Refresh candidate list
      const list = await candidateService.getAll();
      setAllCandidates(list);
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
    <div className="h-screen flex items-center justify-center bg-white">
      <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600"></div>
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
      return <CandidateAuth onAuthSuccess={(u) => { handleAuthSuccess(u); navigate('/candidate/profile'); }} />;
    }

    if (path === '/candidate/profile') {
      if (!user || user.role !== UserRole.CANDIDATE) {
        navigate('/candidate/auth');
        return null;
      }
      const profile = allCandidates.find(c => c.userId === user.id);
      if (!profile) {
        // Create profile if not exists
        candidateService.createProfile(user.id).then(p => {
          setAllCandidates(prev => [...prev, p]);
        });
        return (
          <div className="h-screen flex items-center justify-center bg-white">
            <div className="animate-spin rounded-full h-12 w-12 border-b-4 border-orange-600"></div>
          </div>
        );
      }
      return <CandidateProfilePage profile={profile} onNavigate={navigate} onSave={handleUpdateCandidate} onLogout={handleLogout} />;
    }

    if (path === '/talents') return <TalentMarketplace candidates={allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE)} onNavigate={navigate} user={user} />;

    if (path.startsWith('/talents/')) {
      const id = path.split('/').pop();
      return <TalentMarketplace candidates={allCandidates.filter(c => c.isPublished && c.status === CandidateStatus.ACTIVE)} selectedId={id} onNavigate={navigate} user={user} />;
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
      <div className="p-20 text-center bg-white h-screen flex flex-col items-center justify-center">
        <h2 className="text-4xl font-black text-slate-900 mb-6 tracking-tighter">404 - SEITE NICHT GEFUNDEN</h2>
        <Button size="lg" onClick={() => navigate('/')}>Zurück zur Startseite</Button>
      </div>
    );
  };

  return (
    <div className="min-h-screen font-inter bg-white">
      {renderRoute()}
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
};

export default App;
