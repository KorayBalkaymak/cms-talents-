import React, { useEffect, useState } from 'react';
import { api } from '../services/ApiClient';
import { authService } from '../services/AuthService';
import { Button } from '../components/UI';
import { UserRole } from '../types';

const VerifyEmail: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const openRoute = (path: string) => {
    window.location.href = `${window.location.origin}/#${path}`;
  };

  useEffect(() => {
    const run = async () => {
      try {
        const result = await api.verifyEmail();
        if (result.success) {
          await authService.refreshCurrentUser();
          const current = authService.getCurrentUser();
          setStatus('success');
          setMessage(result.message || 'E-Mail bestätigt. Sie können sich jetzt anmelden.');

          if (!current) {
            return;
          }
          return;
        }

        setStatus('error');
        setMessage(result.error || 'Bestätigung fehlgeschlagen.');
      } catch (e: any) {
        setStatus('error');
        setMessage(e?.message || 'Bestätigung fehlgeschlagen.');
      }
    };

    run();
  }, []);

  const currentUser = authService.getCurrentUser();
  const primaryLabel =
    currentUser?.role === UserRole.RECRUITER || currentUser?.role === UserRole.ADMIN
      ? 'Zum Dashboard'
      : currentUser?.role === UserRole.CANDIDATE
        ? 'Zum Profil'
        : 'Zum Login';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border border-slate-200 p-8 text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-12 w-12 border-2 border-slate-200 border-t-orange-500 mx-auto mb-6" />
            <p className="text-slate-600 font-medium">E-Mail wird bestätigt …</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">E-Mail bestätigt</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <Button
              className="w-full"
              onClick={() => {
                if (currentUser?.role === UserRole.CANDIDATE) {
                  openRoute('/candidate/profile');
                  return;
                }
                if (currentUser?.role === UserRole.RECRUITER || currentUser?.role === UserRole.ADMIN) {
                  openRoute('/recruiter/dashboard');
                  return;
                }
                openRoute('/candidate/auth');
              }}
            >
              {primaryLabel}
            </Button>
            <p className="text-sm text-slate-500 mt-4">
              <button
                type="button"
                onClick={() => openRoute('/')}
                className="text-orange-600 hover:underline"
              >
                Zur Startseite
              </button>
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Bestätigung fehlgeschlagen</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <Button variant="outline" className="w-full" onClick={() => openRoute('/')}>
              Zur Startseite
            </Button>
            <Button className="w-full mt-3" onClick={() => openRoute('/candidate/auth')}>
              Erneut registrieren
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
