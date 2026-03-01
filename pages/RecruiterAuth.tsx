
import React, { useState } from 'react';
import { Button, Input } from '../components/UI';
import { User, UserRole } from '../types';
import { authService } from '../services/AuthService';

interface RecruiterAuthProps {
  onAuthSuccess: (user: User) => void;
}

const RecruiterAuth: React.FC<RecruiterAuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationToken, setVerificationToken] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('E-Mail und Passwort sind erforderlich.');
      return;
    }
    if (!isLogin) {
      if (password.length < 8) {
        setError('Passwort muss mindestens 8 Zeichen haben.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwörter stimmen nicht überein.');
        return;
      }
    }

    setIsLoading(true);

    try {
      if (isLogin) {
        const result = await authService.login(email, password, UserRole.RECRUITER);
        if (result.success && result.user) {
          onAuthSuccess(result.user);
        } else if (result.needsVerification && result.verificationToken) {
          setVerificationToken(result.verificationToken);
          setError('');
        } else {
          setError(result.error || 'Anmeldung fehlgeschlagen.');
        }
      } else {
        const result = await authService.register(email, password, UserRole.RECRUITER);
        if (result.success && result.user) {
          onAuthSuccess(result.user);
        } else if (result.success && result.verificationToken) {
          setVerificationToken(result.verificationToken);
          setError('');
        } else {
          setError(result.error || 'Registrierung fehlgeschlagen.');
        }
      }
    } catch (e) {
      setError('Ein unerwarteter Fehler ist aufgetreten.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex">
      {/* Visual Side (Left) - SCALED DOWN */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-slate-900 overflow-hidden items-center justify-center p-8">
        {/* Abstract Background Shapes */}
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-orange-600/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] bg-indigo-600/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/4 pointer-events-none"></div>

        {/* Pattern overlay */}
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMSIgY3k9IjEiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wNSkiLz48L3N2Zz4=')] opacity-20"></div>

        <div className="relative z-10 max-w-md text-center">
          <div className="mb-6 inline-flex items-center justify-center">
            <img src="/cms-talents-logo.jpg" alt="CMS Talents" className="h-12 w-auto object-contain" />
          </div>
          <h1 className="text-3xl font-black text-white tracking-tight mb-4 leading-tight">
            Willkommen im <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-orange-200">Partner Portal</span>
          </h1>
          <p className="text-sm text-slate-400 font-medium leading-relaxed max-w-sm mx-auto">
            Verwalten Sie Ihre Kandidaten, sichten Sie Talente und steuern Sie den Recruiting-Prozess zentral.
          </p>

          <div className="mt-8 flex items-center justify-center gap-3 text-[10px] font-bold text-slate-600 uppercase tracking-widest">
            <span>Security First</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
            <span>GDPR Compliant</span>
            <span className="w-1 h-1 bg-slate-600 rounded-full"></span>
            <span>Premium Talent</span>
          </div>
        </div>
      </div>

      {/* Login Form Side (Right) - SCALED DOWN */}
      <div className="flex-1 flex flex-col justify-center p-8 bg-white relative">
        <div className="w-full max-w-sm mx-auto">
          <div className="mb-8">
            <a href="#/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors mb-6 group">
              <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Zurück
            </a>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mb-1">
              {isLogin ? 'Login Recruiter' : 'Recruiter registrieren'}
            </h2>
            <p className="text-slate-500 text-sm">
              {isLogin ? 'Bitte melden Sie sich an.' : 'Erstellen Sie Ihren Partner-Account.'}
            </p>
          </div>

          {verificationToken ? (
            <div className="mb-6 p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center">
              <p className="text-emerald-800 text-sm font-medium mb-4">
                Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse. Klicken Sie auf den Button unten – danach können Sie sich anmelden.
              </p>
              <a
                href={`#/verify-email?token=${encodeURIComponent(verificationToken)}`}
                className="inline-block w-full py-3 px-4 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors text-center text-sm"
              >
                E-Mail jetzt bestätigen
              </a>
            </div>
          ) : (
            <>
          {error && (
            <div className="mb-6 p-3 bg-rose-50 border-l-4 border-rose-500 rounded-r-lg flex items-start gap-2">
              <svg className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              <p className="text-rose-700 text-xs font-bold">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-900 uppercase tracking-wide ml-1">E-Mail</label>
              <Input
                type="email"
                placeholder="name@firma.de"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                className="bg-slate-50 border-slate-200 focus:bg-white h-11 text-sm rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-wide">Passwort</label>
                {isLogin && (
                  <button type="button" className="text-[10px] font-bold text-orange-600 hover:text-orange-700">Vergessen?</button>
                )}
              </div>
              <Input
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className="bg-slate-50 border-slate-200 focus:bg-white h-11 text-sm rounded-xl"
              />
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-900 uppercase tracking-wide ml-1">Passwort bestätigen</label>
                <Input
                  type="password"
                  placeholder="••••••••"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="bg-slate-50 border-slate-200 focus:bg-white h-11 text-sm rounded-xl"
                />
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              className="w-full py-3.5 text-sm rounded-xl shadow-lg shadow-orange-200 mt-2"
              isLoading={isLoading}
            >
              {isLogin ? 'Zum Dashboard' : 'Kostenlos registrieren'}
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-sm text-slate-500">
              {isLogin ? 'Noch keinen Account?' : 'Bereits registriert?'}
              <button
                type="button"
                onClick={() => { setIsLogin(!isLogin); setError(''); setConfirmPassword(''); setVerificationToken(null); }}
                className="ml-2 text-orange-600 font-bold hover:text-orange-700"
              >
                {isLogin ? 'Jetzt registrieren' : 'Hier anmelden'}
              </button>
            </p>
          </div>
            </>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <p className="text-slate-400 text-[10px]">
              Support: <a href="#" className="font-bold text-slate-600 hover:text-orange-600 underline">help@cms-talents.de</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RecruiterAuth;
