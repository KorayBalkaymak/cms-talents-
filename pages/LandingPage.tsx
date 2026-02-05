
import React from 'react';
import { Button } from '../components/UI';

import { User, UserRole } from '../types';

interface LandingPageProps {
  onNavigate: (path: string) => void;
  user?: User | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ onNavigate, user }) => {
  return (
    <div className="bg-white min-h-screen flex flex-col font-inter">
      {/* Navigation - Scaled Down */}
      <nav className="fixed top-0 w-full z-50 bg-slate-900 border-b border-slate-800 shadow-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => onNavigate('/')}>
            <div className="w-8 h-8 bg-orange-600 rounded-lg flex items-center justify-center shadow-lg shadow-orange-600/20">
              <span className="text-white font-black italic text-lg">CT</span>
            </div>
            <span className="text-lg font-black tracking-tighter text-white uppercase">CMS <span className="text-orange-500">Talents</span></span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <button onClick={() => onNavigate('/talents')} className="text-[10px] font-black text-slate-300 hover:text-orange-500 transition-colors uppercase tracking-[0.2em]">Marktplatz</button>
            {user ? (
              <>
                <span className="text-xs font-bold text-slate-400">Hallo, {user.firstName || 'User'}</span>
                {user.role === UserRole.CANDIDATE ? (
                  <Button variant="primary" size="sm" className="rounded-lg px-4 h-9 text-xs" onClick={() => onNavigate('/candidate/profile')}>Mein Profil</Button>
                ) : (
                  <Button variant="primary" size="sm" className="rounded-lg px-4 h-9 text-xs" onClick={() => onNavigate('/recruiter/dashboard')}>Zum Dashboard</Button>
                )}
              </>
            ) : (
              <>
                <button onClick={() => onNavigate('/recruiter/auth')} className="text-[10px] font-black text-slate-300 hover:text-orange-500 transition-colors uppercase tracking-[0.2em]">Partner-Login</button>
                <Button variant="primary" size="sm" className="rounded-lg px-4 h-9 text-xs" onClick={() => onNavigate('/candidate/auth')}>Kandidat werden</Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Main Hero - Scaled Down */}
      <main className="flex-1 pt-20">
        <section className="pt-16 pb-20 relative overflow-hidden">
          {/* Background Elements */}
          <div className="absolute top-0 right-0 w-1/3 h-full bg-slate-900 transform skew-x-[-15deg] translate-x-1/2 opacity-5 pointer-events-none"></div>
          <div className="absolute top-20 right-20 w-80 h-80 bg-orange-600/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="max-w-6xl mx-auto px-6 relative z-10">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                {/* BADGE REMOVED PER USER REQUEST */}

                <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tighter mb-6 leading-[0.9]">
                  FÜR DIE <span className="text-orange-600">BESTEN</span> <br />
                  DER BESTEN.
                </h1>

                <p className="text-base text-slate-500 mb-8 font-medium leading-relaxed max-w-md">
                  CMS Talents verbindet hochqualifizierte Fachkräfte mit den exklusivsten Arbeitgebern. Fokus auf das Wesentliche: <span className="text-slate-900 font-bold underline decoration-orange-500 decoration-2">Qualität.</span>
                </p>

                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="md" className="px-8 py-3 rounded-xl shadow-xl shadow-orange-600/20 text-sm uppercase tracking-widest font-black" onClick={() => onNavigate('/candidate/auth')}>
                    Profil erstellen
                  </Button>
                  <Button variant="secondary" size="md" className="px-8 py-3 rounded-xl shadow-xl shadow-slate-900/10 text-sm uppercase tracking-widest font-black" onClick={() => onNavigate('/talents')}>
                    Talente finden
                  </Button>
                </div>
              </div>

              {/* Visual - Scaled Down */}
              <div className="relative hidden lg:block scale-90 origin-right">
                <div className="relative bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2rem] p-8 shadow-2xl">
                  <div className="grid grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className={`aspect-square rounded-xl flex items-center justify-center ${i % 3 === 0 ? 'bg-orange-600' : i % 2 === 0 ? 'bg-slate-700' : 'bg-slate-800 border border-slate-700'}`}>
                        {i === 3 && <div className="text-xl font-black text-orange-500">CT</div>}
                      </div>
                    ))}
                  </div>
                  {/* Stats */}
                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
                      <div className="text-2xl font-black text-orange-500">98%</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Matching</div>
                    </div>
                    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-3 border border-slate-700">
                      <div className="text-2xl font-black text-white">500+</div>
                      <div className="text-[9px] font-black uppercase tracking-widest text-slate-400 mt-0.5">Talente</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Value Props - Scaled Down */}
        <section className="py-20 bg-slate-50 border-y border-slate-100">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-black text-slate-900 tracking-tighter uppercase mb-2">Warum CMS Talents?</h2>
              <div className="w-12 h-1.5 bg-orange-600 mx-auto rounded-full"></div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {[
                { title: 'EXKLUSIVITÄT', text: 'Wir prüfen jedes Profil manuell für maximale Qualität.', icon: 'M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A10.003 10.003 0 0110 3v4m12 8V9a2 2 0 00-2-2h-3m3 3h-3m0 0v10m-5-2l-3 4-3-4' },
                { title: 'DATENSCHUTZ', text: 'Kandidaten entscheiden selbst über ihre Sichtbarkeit.', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z' },
                { title: 'SPEED-MATCH', text: 'Effizientes Finden dank Keyword-Boosting.', icon: 'M13 10V3L4 14h7v7l9-11h-7z' }
              ].map((item, idx) => (
                <div key={idx} className="bg-white p-8 rounded-2xl border border-slate-100 shadow-lg shadow-slate-200/50">
                  <div className="w-12 h-12 bg-orange-600 rounded-xl flex items-center justify-center mb-4 text-white shadow-lg shadow-orange-600/30">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={item.icon}></path></svg>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-2">{item.title}</h3>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed">{item.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section - Scaled Down */}
        <section className="py-20 bg-slate-900">
          <div className="max-w-4xl mx-auto px-6 text-center">
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tighter mb-4">
              Bereit für den nächsten Schritt?
            </h2>
            <p className="text-base text-slate-400 mb-8">
              Erstelle dein Profil in Minuten.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="md" className="px-8 py-3 rounded-xl shadow-xl shadow-orange-600/30 text-sm" onClick={() => onNavigate('/candidate/auth')}>
                Jetzt starten
              </Button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer - Scaled Down */}
      <footer className="bg-slate-900 py-10 border-t border-slate-800">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 bg-orange-600 rounded flex items-center justify-center font-black text-white italic text-xs">CT</div>
            <span className="font-black text-white tracking-widest text-xs">CMS TALENTS © 2026</span>
          </div>
          <div className="flex gap-6 text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">
            <a href="#" className="hover:text-orange-500 transition-colors">Impressum</a>
            <a href="#" className="hover:text-orange-500 transition-colors">Datenschutz</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
