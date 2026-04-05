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
          <div className="w-full max-w-6xl mx-auto px-6 flex items-center justify-end">
            <div className="flex items-center gap-4 md:gap-10">
              {user ? (
                <>
                  <span className="text-sm text-slate-500 hidden md:inline">Hallo, {user.firstName || 'User'}</span>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl px-4 md:px-5 h-9 md:h-10 text-xs md:text-sm font-medium shadow-sm bg-[#101B31] border-[#101B31] hover:bg-[#0B1324] active:bg-[#070D19]"
                    onClick={() => onNavigate('/recruiter/auth')}
                  >
                    Als Recruiter anmelden
                  </Button>
                  {user.role === UserRole.CANDIDATE ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-xl px-4 md:px-5 h-9 md:h-10 text-xs md:text-sm font-medium shadow-sm bg-[#101B31] border-[#101B31] hover:bg-[#0B1324] active:bg-[#070D19]"
                      onClick={() => onNavigate('/candidate/profile')}
                    >
                      Mein Profil
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="rounded-xl px-4 md:px-5 h-9 md:h-10 text-xs md:text-sm font-medium shadow-sm bg-[#101B31] border-[#101B31] hover:bg-[#0B1324] active:bg-[#070D19]"
                      onClick={() => onNavigate('/recruiter/dashboard')}
                    >
                      Dashboard
                    </Button>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl px-4 md:px-5 h-9 md:h-10 text-xs md:text-sm font-medium shadow-sm bg-[#101B31] border-[#101B31] hover:bg-[#0B1324] active:bg-[#070D19]"
                    onClick={() => onNavigate('/recruiter/auth')}
                  >
                    Als Recruiter anmelden
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="rounded-xl px-4 md:px-5 h-9 md:h-10 text-xs md:text-sm font-medium shadow-sm bg-[#101B31] border-[#101B31] hover:bg-[#0B1324] active:bg-[#070D19]"
                    onClick={() => onNavigate('/candidate/auth')}
                  >
                    Mein Profil
                  </Button>
                </div>
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

          <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-28 md:pt-32 md:pb-36">
            <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16 xl:gap-20">
              <div className="w-full min-w-[16rem]">
                <style>{`
                  @keyframes cmsLogoShineSweep {
                    0% { transform: translateX(-160%) rotate(25deg); opacity: 0; }
                    8% { opacity: 1; }
                    35% { transform: translateX(160%) rotate(25deg); opacity: 1; }
                    100% { transform: translateX(160%) rotate(25deg); opacity: 0; }
                  }
                  @keyframes cmsLogoAuraPulse {
                    0%, 100% { transform: scale(0.98); opacity: 0.35; }
                    50% { transform: scale(1.06); opacity: 0.75; }
                  }
                  .cms-logo-shine {
                    position: absolute;
                    top: -70%;
                    left: -70%;
                    width: 55%;
                    height: 240%;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
                    filter: blur(0.5px);
                    animation: cmsLogoShineSweep 2.8s ease-in-out infinite;
                    opacity: 0;
                  }
                  .cms-logo-aura {
                    position: absolute;
                    inset: -22px;
                    border-radius: 9999px;
                    background: radial-gradient(circle at 50% 50%,
                      rgba(255,255,255,0.22) 0%,
                      rgba(255,255,255,0.10) 35%,
                      rgba(249,115,22,0.38) 55%,
                      rgba(249,115,22,0.10) 70%,
                      transparent 78%);
                    filter: blur(10px);
                    animation: cmsLogoAuraPulse 2.8s ease-in-out infinite;
                    pointer-events: none;
                  }
                  .cms-spotlight-beam {
                    position: absolute;
                    top: -260px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 260px;
                    height: 340px;
                    clip-path: polygon(50% 0%, 0% 100%, 100% 100%);
                    background: linear-gradient(to bottom, rgba(255,255,255,0.35), rgba(255,255,255,0.0));
                    filter: blur(0.2px);
                    opacity: 0.45;
                    pointer-events: none;
                  }
                `}</style>

                {/* Logo-Badge: feste Größen (w-56/sm:w-64), damit die Spalte nicht auf ~0px kollabiert */}
                <div className="animate-fade-in-up mb-8 flex w-full justify-center lg:justify-start">
                  <div className="relative inline-flex shrink-0">
                    <div className="cms-spotlight-beam" style={{ width: 320, opacity: 0.26 }} />
                    <div className="cms-spotlight-beam" style={{ width: 240, opacity: 0.38 }} />
                    <div className="cms-spotlight-beam" style={{ width: 170, opacity: 0.55 }} />

                    <div className="absolute -inset-10 rounded-full bg-orange-500/20 blur-3xl" />
                    <div className="cms-logo-aura" />

                    <div className="relative flex h-56 w-56 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:h-64 sm:w-64">
                      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
                        <div className="cms-logo-shine" />
                      </div>

                      <div className="relative flex h-52 w-52 shrink-0 items-center justify-center rounded-full bg-white shadow-[0_20px_50px_-35px_rgba(0,0,0,0.55)] sm:h-60 sm:w-60">
                        <div className="pointer-events-none absolute inset-0 rounded-full bg-[radial-gradient(circle_at_30%_20%,rgba(255,255,255,1),rgba(255,255,255,0.75)_45%,rgba(255,255,255,1)_100%)]" />
                        <img
                          src="/1adef99a-1986-43bc-acb8-278472ee426c.png"
                          alt="CMS Talents"
                          className="relative h-[85%] w-[85%] object-contain drop-shadow-[0_10px_20px_rgba(0,0,0,0.18)]"
                          loading="lazy"
                          decoding="async"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mx-auto max-w-xl lg:mx-0">
                <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-bold text-white tracking-tight leading-[1.1] mb-6 animate-fade-in-up-1">
                  Die besten Talente.
                  <br />
                  <span className="text-orange-400">Die besten Partner.</span>
                </h1>
                <p className="text-lg text-white/80 leading-relaxed mb-10 animate-fade-in-up-2">
                  CMS Talents verbindet qualifizierte Fachkräfte mit führenden Arbeitgebern. Qualität, Vertrauen und passgenaues Matching – ohne Kompromisse.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fade-in-up-3">
                  <Button
                    size="md"
                    variant="primary"
                    className="w-full justify-center rounded-xl px-7 py-3.5 text-sm font-semibold tracking-tight !bg-orange-500 hover:!bg-orange-600 !text-white !border-orange-500 shadow-lg shadow-orange-500/30 transition-all duration-200"
                    onClick={() => onNavigate('/candidate/auth')}
                  >
                    Profil erstellen
                  </Button>
                  <Button
                    size="md"
                    variant="primary"
                    className="w-full justify-center rounded-xl px-7 py-3.5 text-sm font-semibold tracking-tight !bg-orange-500 hover:!bg-orange-600 !text-white !border-orange-500 shadow-lg shadow-orange-500/30 transition-all duration-200"
                    onClick={() => onNavigate('/talents')}
                  >
                    Talente finden
                  </Button>
                </div>
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
                            fg: 'text-orange-100',
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
                            fg: 'text-orange-100',
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
                            className={`flex aspect-square items-center justify-center rounded-lg ${
                              item.key === 'work' || item.key === 'search' ? 'bg-orange-500' : item.bg
                            }`}
                          >
                            <div className={item.key === 'work' || item.key === 'search' ? 'text-white' : item.fg}>
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

        {/* ─── Zweck: klares Orange (ohne Kupfer/Gehaltsrechner) ─── */}
        <section className="bg-white py-20 md:py-28">
          <div className="relative mx-auto max-w-6xl px-6">
            <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl shadow-orange-500/25">
              <div className="p-10 md:p-14">
                <div className="mb-10 flex flex-col items-center text-center">
                  <h2 className="mb-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                    Warum es CMS <span className="text-orange-100">Talents</span> gibt
                  </h2>
                  <p className="text-lg font-semibold text-white/95">Der Zweck von CMS Talents</p>
                  <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/95">
                    CMS Talents ist eine Recruiting-Plattform, die{' '}
                    <span className="font-semibold text-orange-50">qualifizierte Fachkräfte</span> mit{' '}
                    <span className="font-semibold text-orange-50">passenden Arbeitgebern</span> zusammenbringt. Kandidaten erstellen ihr Profil, werden sichtbar und können von
                    Recruitern gezielt gefunden werden.
                  </p>
                  <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/85">
                    Im Mittelpunkt stehen Qualität, Vertrauen und ein transparentes Matching – damit beide Seiten schneller die richtige Verbindung finden.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── Value props: dunkelblau, Orange-Akzente ─── */}
        <section className="bg-[#101B31] py-24 md:py-32">
          <div className="mx-auto max-w-6xl px-6">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="mb-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
                Was CMS <span className="text-orange-400">Talents</span> auszeichnet
              </h2>
              <p className="text-lg leading-relaxed text-white/75">
                Qualität und Vertrauen stehen im Mittelpunkt – für Kandidaten und Arbeitgeber.
              </p>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  title: 'Besseres Matching',
                  description: 'Klare Profile – damit du schneller die richtigen Talente findest.',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                      {/* Clipboard / Papier */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 3h6a2 2 0 012 2v15a2 2 0 01-2 2H9a2 2 0 01-2-2V5a2 2 0 012-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 8h6" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 11h6" />
                      {/* Stift */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.75 14.25l4-4a1.75 1.75 0 012.475 2.475l-4 4-2.95.8.475-3.275z" />
                    </svg>
                  ),
                },
                {
                  title: 'Datenschutz',
                  description: 'Kandidaten behalten die volle Kontrolle über Sichtbarkeit und Nutzung ihrer Daten.',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8">
                      {/* Bügel */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.5 11V8.8a3.5 3.5 0 017 0V11" />
                      {/* Schlosskörper */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 11h10a2 2 0 012 2v6a2 2 0 01-2 2H7a2 2 0 01-2-2v-6a2 2 0 012-2z" />
                      {/* Schlüsselloch */}
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 14.2a.8.8 0 100 1.6.8.8 0 000-1.6z" />
                    </svg>
                  ),
                },
                {
                  title: 'Transparente Profile',
                  description: 'Klare Angaben zu Skills, Erfahrung und Verfügbarkeit – damit Entscheidungen schneller und sicherer fallen.',
                  icon: (
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                  ),
                },
              ].map((item, idx) => (
                <div
                  key={idx}
                  className="group relative overflow-hidden rounded-2xl border border-orange-500/35 bg-orange-500/10 p-8 shadow-lg shadow-black/20 transition-all duration-300 hover:border-orange-400/60 hover:bg-orange-500/15"
                >
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-500 text-white shadow-md shadow-orange-500/30 transition-colors duration-300 group-hover:bg-orange-400">
                    {item.icon}
                  </div>
                  <h3 className="mb-3 text-xl font-semibold tracking-tight text-white">{item.title}</h3>
                  <p className="leading-relaxed text-white/80">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      {/* ─── Footer: weiß ─── */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 px-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-slate-600">CMS Talents © 2026</span>
          </div>
          <div className="flex gap-10 text-sm">
            <a href="#" className="text-slate-600 transition-colors duration-200 hover:text-orange-600">
              Impressum
            </a>
            <a href="#" className="text-slate-600 transition-colors duration-200 hover:text-orange-600">
              Datenschutz
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
