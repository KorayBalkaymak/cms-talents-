import React from 'react';

export interface CmsLogoHeroBadgeProps {
  /** Zusätzliche Klassen am äußeren Wrapper (z. B. Abstände, Ausrichtung) */
  className?: string;
  /** Landing: sanftes Einblenden */
  animate?: boolean;
}

/**
 * CMS-Talents-Logo wie auf der Landingpage: Spotlights, Aura, äußerer Ring, weißer Innenkreis.
 * Feste Größe w-56 / sm:w-64 (identisch zur Landingpage).
 */
export const CmsLogoHeroBadge: React.FC<CmsLogoHeroBadgeProps> = ({ className = '', animate = false }) => {
  return (
    <>
      <style>{`
        @keyframes cmsLhbShineSweep {
          0% { transform: translateX(-160%) rotate(25deg); opacity: 0; }
          8% { opacity: 1; }
          35% { transform: translateX(160%) rotate(25deg); opacity: 1; }
          100% { transform: translateX(160%) rotate(25deg); opacity: 0; }
        }
        @keyframes cmsLhbAuraPulse {
          0%, 100% { transform: scale(0.98); opacity: 0.35; }
          50% { transform: scale(1.06); opacity: 0.75; }
        }
        .cms-lhb-shine {
          position: absolute;
          top: -70%;
          left: -70%;
          width: 55%;
          height: 240%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent);
          filter: blur(0.5px);
          animation: cmsLhbShineSweep 2.8s ease-in-out infinite;
          opacity: 0;
        }
        .cms-lhb-aura {
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
          animation: cmsLhbAuraPulse 2.8s ease-in-out infinite;
          pointer-events: none;
        }
        .cms-lhb-spotlight {
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
      <div
        className={`flex max-w-full shrink-0 justify-center lg:justify-start ${animate ? 'animate-fade-in-up' : ''} ${className}`.trim()}
      >
        <div className="relative inline-flex shrink-0">
          <div className="cms-lhb-spotlight" style={{ width: 320, opacity: 0.26 }} />
          <div className="cms-lhb-spotlight" style={{ width: 240, opacity: 0.38 }} />
          <div className="cms-lhb-spotlight" style={{ width: 170, opacity: 0.55 }} />

          <div className="absolute -inset-10 rounded-full bg-orange-500/20 blur-3xl" />
          <div className="cms-lhb-aura" />

          <div className="relative flex h-56 w-56 shrink-0 items-center justify-center rounded-full border border-white/25 bg-white/10 shadow-[0_28px_90px_-60px_rgba(0,0,0,0.85)] backdrop-blur-sm sm:h-64 sm:w-64">
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-full">
              <div className="cms-lhb-shine" />
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
    </>
  );
};

export default CmsLogoHeroBadge;
