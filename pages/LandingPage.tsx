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
              <img
                src="/cms-talents-logo.jpg"
                alt="CMS Talents"
                className="h-11 md:h-12 w-auto object-contain"
              />
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
              <div className="relative mt-12 lg:mt-0">
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
                        {[
                          {
                            key: 'work',
                            bg: 'bg-orange-500',
                            fg: 'text-white',
                            icon: (
                              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                                <path d="M9 7V6a3 3 0 0 1 3-3h0a3 3 0 0 1 3 3v1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M4 8h16v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M4 12h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            )
                          },
                          {
                            key: 'handshake',
                            bg: 'bg-white/10 border border-white/20',
                            fg: 'text-white',
                            icon: (
                              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m11 17 2 2a1 1 0 1 0 3-3" />
                                <path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.88-3.88a3 3 0 0 0-4.24 0l-.88.88a1 1 0 1 1-3-3l2.81-2.81a5.79 5.79 0 0 1 7.06-.87l.47.28a2 2 0 0 0 1.42.25L21 4" />
                                <path d="m21 3 1 11h-2" />
                                <path d="M3 3 2 14l6.5 6.5a1 1 0 1 0 3-3" />
                                <path d="M3 4h8" />
                              </svg>
                            )
                          },
                          {
                            key: 'laptop-worker',
                            bg: 'bg-white/10 border border-white/20',
                            fg: 'text-white/85',
                            icon: (
                              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                {/* Laptop */}
                                <path d="M18 5a2 2 0 0 1 2 2v8.526a2 2 0 0 0 .212.897l1.068 2.127a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45l1.068-2.127A2 2 0 0 0 4 15.526V7a2 2 0 0 1 2-2z" />
                                <path d="M20.054 15.987H3.946" />
                                {/* Person on screen */}
                                <circle cx="12" cy="10" r="2.1" />
                                <path d="M9.2 13.3a3.6 3.6 0 0 1 5.6 0" />
                              </svg>
                            )
                          },
                          {
                            key: 'search',
                            bg: 'bg-orange-500',
                            fg: 'text-white',
                            icon: (
                              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                                <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" stroke="currentColor" strokeWidth="2" />
                                <path d="M16.5 16.5 21 21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            )
                          },
                          {
                            key: 'construction',
                            bg: 'bg-white/10 border border-white/20',
                            fg: 'text-white/85',
                            icon: (
                              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                                <path d="M5 10a7 7 0 0 1 14 0v2H5v-2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M9 10V7.5a3 3 0 0 1 6 0V10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M6 12v6a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-6" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                              </svg>
                            )
                          },
                          {
                            key: 'industry',
                            bg: 'bg-white/10 border border-white/20',
                            fg: 'text-white',
                            icon: (
                              <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6">
                                <path d="M4 21V9l6 3V9l6 3V7l4 2v12H4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                                <path d="M8 21v-4h2v4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M14 21v-6h2v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                                <path d="M18 11v.01" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
                              </svg>
                            )
                          }
                        ].map((item) => (
                          <div
                            key={item.key}
                            className={`aspect-square rounded-lg flex items-center justify-center ${item.bg}`}
                          >
                            <div className={`${item.fg}`}>
                              {item.icon}
                            </div>
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
        <section className="relative py-20 md:py-28 bg-orange-500 overflow-hidden">
          {/* Premium overlays */}
          <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_20%_20%,rgba(255,255,255,0.20),transparent_55%),radial-gradient(700px_circle_at_80%_30%,rgba(0,0,0,0.18),transparent_55%)] pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-[520px] h-[520px] rounded-full bg-white/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-32 -left-32 w-[620px] h-[620px] rounded-full bg-[#101B31]/30 blur-3xl pointer-events-none" />
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/35 to-transparent pointer-events-none" />

          <div className="relative max-w-6xl mx-auto px-6">
            <div className="rounded-3xl bg-[#0a1428]/90 backdrop-blur border border-white/10 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.9)] overflow-hidden">
              <div className="p-10 md:p-14">
                <div className="flex flex-col items-center text-center mb-10">
                  <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/10 text-white/90 text-xs font-semibold tracking-wide">
                    <span className="w-2 h-2 rounded-full bg-orange-400" />
                    Warum es CMS Logo gibt
                  </span>
                  <h2 className="mt-5 text-3xl md:text-4xl font-bold text-white tracking-tight">
                    Der Zweck von <span className="text-orange-400">CMS Logo</span>
                  </h2>
                  <p className="mt-4 max-w-3xl text-lg text-white/85 leading-relaxed">
                    CMS Logo ist eine Recruiting-Plattform, die <span className="text-orange-300 font-semibold">hochqualifizierte Fachkräfte</span> mit <span className="text-orange-300 font-semibold">passenden Arbeitgebern</span> zusammenbringt.
                    Kandidaten erstellen ihr Profil, werden sichtbar und können von Recruitern gezielt gefunden werden.
                  </p>
                  <p className="mt-4 max-w-3xl text-base text-white/70 leading-relaxed">
                    Im Mittelpunkt stehen Qualität, Vertrauen und ein transparentes Matching – damit beide Seiten schneller die richtige Verbindung finden.
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  {[
                    {
                      title: 'Qualität',
                      text: 'Strukturierte Profile, klare Signale und Fokus auf Substanz – statt reiner Masse.',
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2l2.6 6.2L21 9l-5 4.2L17.2 21 12 17.9 6.8 21 8 13.2 3 9l6.4-.8L12 2Z" />
                        </svg>
                      ),
                    },
                    {
                      title: 'Vertrauen',
                      text: 'Datenschutz, Kontrolle über Sichtbarkeit und ein professionelles Umfeld für beide Seiten.',
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 2 20 6v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4Z" />
                          <path d="m9 12 2 2 4-5" />
                        </svg>
                      ),
                    },
                    {
                      title: 'Matching',
                      text: 'Gezielte Suche, klare Filter und relevante Profile – für schnellere Entscheidungen.',
                      icon: (
                        <svg viewBox="0 0 24 24" fill="none" className="w-6 h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M10.5 18a7.5 7.5 0 1 1 0-15 7.5 7.5 0 0 1 0 15Z" />
                          <path d="M16.5 16.5 21 21" />
                        </svg>
                      ),
                    },
                  ].map((item) => (
                    <div key={item.title} className="group rounded-2xl bg-white/5 border border-white/10 p-6 hover:bg-white/7.5 transition-colors">
                      <div className="w-11 h-11 rounded-xl bg-orange-500/15 text-orange-300 flex items-center justify-center border border-orange-400/20 group-hover:bg-orange-500/25 transition-colors">
                        {item.icon}
                      </div>
                      <h3 className="mt-4 text-lg font-semibold text-white tracking-tight">{item.title}</h3>
                      <p className="mt-2 text-sm text-white/70 leading-relaxed">{item.text}</p>
                    </div>
                  ))}
                </div>
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
            <img src="/cms-talents-logo.jpg" alt="CMS Talents" className="h-8 w-auto object-contain" />
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
