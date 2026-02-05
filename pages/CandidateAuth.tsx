
import React, { useState } from 'react';
import { Button, Input } from '../components/UI';
import { User, UserRole } from '../types';
import { authService } from '../services/AuthService';

interface CandidateAuthProps {
  onAuthSuccess: (user: User) => void;
}

const CandidateAuth: React.FC<CandidateAuthProps> = ({ onAuthSuccess }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const validateForm = (): boolean => {
    setError('');

    if (!email.trim()) {
      setError('E-Mail-Adresse ist erforderlich.');
      return false;
    }

    if (!password) {
      setError('Passwort ist erforderlich.');
      return false;
    }

    if (!isLogin) {
      if (password.length < 8) {
        setError('Passwort muss mindestens 8 Zeichen lang sein.');
        return false;
      }

      if (password !== confirmPassword) {
        setError('Passwörter stimmen nicht überein.');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setIsLoading(true);
    setError('');

    try {
      if (isLogin) {
        const result = await authService.login(email, password, UserRole.CANDIDATE);
        if (result.success && result.user) {
          onAuthSuccess(result.user);
        } else {
          setError(result.error || 'Anmeldung fehlgeschlagen.');
        }
      } else {
        const result = await authService.register(email, password, UserRole.CANDIDATE);
        if (result.success && result.user) {
          onAuthSuccess(result.user);
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
    <div className="min-h-screen bg-white md:bg-slate-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl md:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.1)] md:border border-slate-100 overflow-hidden">
        <div className="p-10">
          <div className="mb-6">
            <a href="#/" className="inline-flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-orange-600 transition-colors group">
              <svg className="w-3 h-3 group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
              Zurück
            </a>
          </div>

          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-slate-900 rounded-2xl flex items-center justify-center text-orange-500 text-3xl font-black italic shadow-2xl shadow-slate-900/20">
              CT
            </div>
          </div>
          <h2 className="text-3xl font-black text-slate-900 text-center mb-2 tracking-tighter">
            {isLogin ? 'Willkommen zurück' : 'Kandidat werden'}
          </h2>
          <p className="text-slate-400 text-center mb-10 font-bold uppercase text-[10px] tracking-[0.2em]">
            Elite-Matching für Ihre Karriere
          </p>

          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl">
              <p className="text-rose-600 text-sm font-bold text-center">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <Input
              label="E-Mail Adresse"
              type="email"
              placeholder="name@beispiel.de"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
            <Input
              label="Passwort"
              type="password"
              placeholder="••••••••"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={isLogin ? "current-password" : "new-password"}
            />
            {!isLogin && (
              <Input
                label="Passwort bestätigen"
                type="password"
                placeholder="••••••••"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            )}
            <Button
              type="submit"
              variant="primary"
              className="w-full py-4 text-lg rounded-2xl shadow-xl shadow-orange-600/20"
              isLoading={isLoading}
            >
              {isLogin ? 'Anmelden' : 'Kostenlos Registrieren'}
            </Button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-50 text-center">
            <p className="text-sm text-slate-500 font-medium">
              {isLogin ? 'Noch keinen Account?' : 'Bereits Mitglied?'}
              <button
                onClick={() => { setIsLogin(!isLogin); setError(''); setConfirmPassword(''); }}
                className="ml-2 text-orange-600 font-black hover:text-orange-700 transition-colors uppercase text-xs tracking-widest"
              >
                {isLogin ? 'Jetzt registrieren' : 'Hier anmelden'}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CandidateAuth;
