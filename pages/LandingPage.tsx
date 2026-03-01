import React from 'react';
import { Button } from '../components/UI';
import { User, UserRole } from '../types';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  user?: User | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, user }) => {
  return (
    <div className="min-h-screen bg-[#101B31] text-white antialiased">
      {/* ─── Navigation: weißer Header (nicht fixed) ─── */}
      <header className="bg-white border-b border-slate-200/80">
        <nav className="h-[72px] flex items-center justify-center">
          <div className="w-full max-w-6xl mx-auto px-6 flex items-center justify-between">
            <button
              type="button"
              onClick={() => onNavigate('/')}
              className="flex items-center gap-3 group"
            >
              <div className="w-9 h-9 rounded-xl bg-orange-500 flex items-center justify-center text-white font-semibold text-sm group-hover:bg-orange-600 transition-colors duration-200">
                CT
              </div>
              <img src="/cms-talents-logo.svg" alt="CMS Talents Logo" className="h-8" />
            </button>
            <div className="flex items-center gap-4 md:gap-10">
              {user ? (
                <>
                  <span className="text-sm text-slate-500 hidden md:inline">Hallo, {user.firstName || 'User'}</span>
                  {user.role === UserRole.CANDIDATE ? (
                    <Button variant="primary" size="sm" className="rounded-xl px-4 md:px-5 h-9 md:h-10 text-xs md:text-sm font-medium shadow-sm" onClick={() => onNavigate('/candidate/profile')}>
                      Mein Profil
                    </Button>
                  ) : (
                    <Button variant="primary" size="sm" className="rounded-xl px-4 md:px-5 h-9 md:h-10 text-xs md:text-sm font-medium shadow-sm" onClick={() => onNavigate('/recruiter/dashboard')}>
                      Dashboard
                    </Button>
                  )}
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onNavigate('/recruiter/auth')}
                  className="text-xs md:text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors duration-200"
                >
                  Als Recruiter einloggen
                </button>
              )}
            </div>
          </div>
        </nav>
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      </header>

      <main>
        {/* ─── Hero: high-impact, premium ─── */}
        <section className="relative overflow-hidden">
          <div className="absolute top-1/4 -right-1/4 w-[600px] h-[600px] rounded-full bg-orange-500/10 blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

          <div className="relative max-w-6xl mx-auto px-6 pt-24 pb-28 md:pt-32 md:pb-36">
            <div className="grid lg:grid-cols-2 gap-20 items-center">
              <div className="max-w-xl">
                <p className="text-sm font-medium text-orange-400 mb-6 tracking-wide animate-fade-in-up">
                  Premium Talent-Plattform
                </p>
                <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.1] mb-6 animate-fade-in-up-1">
                  Die besten Talente.
                  <br />
                  <span className="text-orange-400">Die besten Partner.</span>
                </h1>
                <p className="text-lg text-white/80 leading-relaxed mb-10 animate-fade-in-up-2">
                  CMS Logo verbindet hochqualifizierte Fachkräfte mit führenden Arbeitgebern. Qualität, Vertrauen und passgenaues Matching – ohne Kompromisse.
                </p>
                <div className="flex flex-wrap gap-4 animate-fade-in-up-3">
                  <Button
                    size="md"
                    className="rounded-xl px-7 py-3.5 text-sm font-semibold bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/30 transition-all duration-200"
                    onClick={() => onNavigate('/candidate/auth')}
                  >
                    Profil erstellen
                  </Button>
                  <Button
                    size="md"
                    className="rounded-xl px-7 py-3.5 text-sm font-semibold bg-orange-500 hover:bg-orange-400 text-white shadow-lg shadow-orange-500/30 transition-all duration-200"
                    onClick={() => onNavigate('/talents')}
                  >
                    Talente finden
                  </Button>
                </div>
              </div>

              {/* Product preview card – premium look */}
              <div className="relative hidden lg:block">
                <div className="relative rounded-2xl bg-white/5 border border-white/10 p-px shadow-2xl">
                  <div className="rounded-2xl bg-[#101B31]/80 overflow-hidden border border-white/10">
                    <div className="p-6 border-b border-white/10">
                      <div className="flex items-center gap-2 mb-4">
                        <div className="flex gap-1.5">
                          <span className="w-2.5 h-2.5 rounded-full bg-white/40" />
                          <span className="w-2.5 h-2.5 rounded-full bg-white/40" />
                          <span className="w-2.5 h-2.5 rounded-full bg-white/40" />
                        </div>
                        <span className="text-xs font-medium text-white/60 ml-2">Talent-Marktplatz</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                          <div
                            key={i}
                            className={`aspect-square rounded-lg flex items-center justify-center ${i % 3 === 1 ? 'bg-orange-500' : 'bg-white/10 border border-white/20'}`}
                          >
                            {i === 2 && <span className="text-sm font-semibold text-orange-200">CT</span>}
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Zweck der App: dunkelblaue Box auf orangem Hintergrund ─── */}
        <section className="py-20 md:py-28 bg-orange-500">
          <div className="max-w-4xl mx-auto px-6">
            <div className="rounded-2xl bg-[#0a1428] border border-white/10 shadow-2xl shadow-black/20 overflow-hidden">
              <div className="p-10 md:p-14">
                <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-6 text-center">
                  Der Zweck von CMS Logo
                </h2>
                <p className="text-lg text-white/90 leading-relaxed mb-6 text-center">
                  CMS Logo ist eine Recruiting-Plattform, die <span className="text-orange-400 font-semibold">hochqualifizierte Fachkräfte</span> mit <span className="text-orange-400 font-semibold">passenden Arbeitgebern</span> zusammenbringt. Kandidaten können ihr Profil anlegen, sich sichtbar machen und von Recruitern gefunden werden. Arbeitgeber und Recruiter nutzen die Plattform, um gezielt nach Talenten zu suchen und den Recruiting-Prozess effizient zu steuern.
                </p>
                <p className="text-base text-white/75 leading-relaxed text-center">
                  Im Mittelpunkt stehen Qualität, Vertrauen und ein transparentes Matching – damit beide Seiten schnell die richtige Verbindung finden.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Value props: weißer Hintergrund, Karten in Blau ─── */}
        <section className="py-24 md:py-32 bg-white">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mb-4">
                Warum CMS <span className="text-orange-500">Logo</span>?
              </h2>
              <p className="text-lg text-slate-600 leading-relaxed">
                Qualität und Vertrauen stehen im Mittelpunkt – für Kandidaten und Arbeitgeber.
              </p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: 'Exklusivität',
                  description: 'Jedes Profil wird manuell geprüft. Maximale Qualität und Relevanz für beide Seiten.',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                  ),
                },
                {
                  title: 'Datenschutz',
                  description: 'Kandidaten behalten die volle Kontrolle über Sichtbarkeit und Nutzung ihrer Daten.',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" /></svg>
                  ),
                },
                {
                  title: 'Schnelles Matching',
                  description: 'Intelligente Suche und Keyword-Boosting für effizientes Recruiting ohne Zeitverschwendung.',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                  ),
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="group relative p-8 rounded-2xl bg-[#101B31] border border-[#101B31] hover:shadow-xl hover:shadow-slate-900/20 transition-all duration-300"
                >
                  <div className="w-12 h-12 rounded-xl bg-orange-500/20 text-orange-400 flex items-center justify-center mb-6 group-hover:bg-orange-500 group-hover:text-white transition-colors duration-300">
                    {item.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3 tracking-tight">{item.title}</h3>
                  <p className="text-white/80 leading-relaxed">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer: minimal, high-end ─── */}
      <footer className="bg-[#101B31] border-t border-white/10 py-12">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white font-semibold text-sm">
              CT
            </div>
            <span className="text-sm font-medium text-white/70">CMS Logo © 2026</span>
          </div>
          <div className="flex gap-10 text-sm">
            <a href="#" className="text-white/70 hover:text-orange-400 transition-colors duration-200">Impressum</a>
            <a href="#" className="text-white/70 hover:text-orange-400 transition-colors duration-200">Datenschutz</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
