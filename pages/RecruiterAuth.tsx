import React, { useState } from 'react';
import { Button, Input } from '../components/UI';
import { User, UserRole } from '../types';
import { authService } from '../services/AuthService';

interface RecruiterAuthProps {
  onAuthSuccess: (user: User) => void;
}

const RecruiterAuth: React.FC<RecruiterAuthProps> = ({ onAuthSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('E-Mail und Passwort sind erforderlich.');
      return;
    }

    setIsLoading(true);

    try {
      const result = await authService.login(email, password, UserRole.RECRUITER);
      if (result.success && result.user) {
        onAuthSuccess(result.user);
      } else {
        setError(result.error || 'Anmeldung fehlgeschlagen.');
      }
    } catch (e) {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center p-8">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Zz4+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-20"></div>

        <div className="relative z-10 max-w-md text-center">
          <div className="mb-6 inline-flex items-center justify-center">
            <div className="relative inline-flex">
              <div className="pointer-events-none absolute -inset-4 rounded-full bg-orange-500/25 blur-xl" aria-hidden />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 shadow-[0_14px_36px_-24px_rgba(0,0,0,0.9)]">
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white shadow-[0_8px_20px_-14px_rgba(0,0,0,0.5)]">
                  <img
                    src="/1adef99a-1986-43bc-acb8-278472ee426c.png"
                    alt="CMS Talents"
                    className="h-[85%] w-[85%] object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.2)]"
                  />
                </div>
              </div>
            </div>
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-4 leading-tight">
            Willkommen im <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-200">Partner Portal</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
            Verwalten Sie Ihre Kandidaten, sichten Sie Talente und steuern Sie den Recruiting-Prozess zentral.
          </p>

        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center p-8 bg-white relative">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8">
            <a href="#/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors mb-6 group">
              <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Zurück
            </a>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              Login Recruiter
            </h2>
          </div>

          {error && (
            <div className="mb-6 p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p className="text-rose-700 text-xs font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" autoComplete="off">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-wide ml-1">E-Mail</label>
              <Input
                type="email"
                placeholder="E-Mail eingeben"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="off"
                name="recruiter_login_email"
                className="bg-slate-50 border-slate-200 focus:bg-white h-11 text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-wide">Passwort</label>
              </div>
              <Input
                type="password"
                placeholder="Passwort eingeben"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
                name="recruiter_login_password"
                className="bg-slate-50 border-slate-200 focus:bg-white h-11 text-sm rounded-xl"
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 text-sm rounded-xl shadow-lg shadow-orange-200 mt-2"
              isLoading={isLoading}
            >
              Zum Dashboard
            </Button>
          </form>

        </div>
      </div>
    </div>
  );
};

export default RecruiterAuth;
