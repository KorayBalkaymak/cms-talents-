import React, { useEffect, useState } from 'react';
import { api } from '../services/ApiClient';
import { Button } from '../components/UI';

const VerifyEmail: React.FC<{ onNavigate: (path: string) => void }> = ({ onNavigate }) => {
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const hash = window.location.hash || '';
    const query = hash.includes('?') ? hash.split('?')[1] : '';
    const params = new URLSearchParams(query);
    const token = params.get('token');

    if (!token) {
      setStatus('error');
      setMessage('Ungültiger Link. Bitte nutzen Sie den Link aus der E-Mail.');
      return;
    }

    api.verifyEmail(token)
      .then((res) => {
        if (res.success) {
          setStatus('success');
          setMessage(res.message || 'E-Mail bestätigt. Sie können sich jetzt anmelden.');
        } else {
          setStatus('error');
          setMessage(res.error || 'Bestätigung fehlgeschlagen.');
        }
      })
      .catch((e: Error) => {
        setStatus('error');
        setMessage(e.message || 'Bestätigung fehlgeschlagen.');
      });
  }, []);

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
              <svg className="w-8 h-8 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">E-Mail bestätigt</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <Button className="w-full" onClick={() => onNavigate('/candidate/auth')}>
              Zum Login
            </Button>
            <p className="text-sm text-slate-500 mt-4">
              <button type="button" onClick={() => onNavigate('/recruiter/auth')} className="text-orange-600 hover:underline">
                Als Recruiter anmelden
              </button>
            </p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Bestätigung fehlgeschlagen</h2>
            <p className="text-slate-600 mb-6">{message}</p>
            <Button variant="outline" className="w-full" onClick={() => onNavigate('/')}>
              Zur Startseite
            </Button>
            <Button className="w-full mt-3" onClick={() => onNavigate('/candidate/auth')}>
              Erneut registrieren
            </Button>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;
