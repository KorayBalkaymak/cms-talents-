import React, { useEffect, useMemo, useState } from 'react';

const FACTORS = [2.0, 2.2, 2.3, 2.4] as const;
type Factor = (typeof FACTORS)[number];

function parseNum(raw: string): number {
  const n = parseFloat(String(raw).replace(',', '.').trim());
  return Number.isFinite(n) ? n : 0;
}

/** Stundenlohn-Rechner: rate × (1 + %/100) × Faktor — Premium Dark UI */
const HourlyRateCalculator: React.FC = () => {
  const [rateInput, setRateInput] = useState('30');
  const [pctInput, setPctInput] = useState('22');
  const [factor, setFactor] = useState<Factor>(2.2);
  const [resultPulse, setResultPulse] = useState(0);

  const rate = parseNum(rateInput);
  const pct = parseNum(pctInput);

  const { intermediate, final } = useMemo(() => {
    const afterPct = rate * (1 + pct / 100);
    return {
      intermediate: afterPct,
      final: afterPct * factor,
    };
  }, [rate, pct, factor]);

  useEffect(() => {
    setResultPulse((k) => k + 1);
  }, [final]);

  return (
    <div className="flex min-h-[min(70vh,720px)] w-full items-center justify-center px-2 py-6 sm:px-4">
      <div
        className="relative w-full max-w-md overflow-hidden rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-b from-[#0c0c0e] via-[#0a0a0c] to-[#050506] p-8 shadow-[0_0_0_1px_rgba(255,255,255,0.04),0_25px_80px_-20px_rgba(0,0,0,0.85),0_0_120px_-40px_rgba(234,88,12,0.15)] sm:p-10"
        style={{ fontFamily: "'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif" }}
      >
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-orange-500/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-sky-500/5 blur-3xl"
          aria-hidden
        />

        <div className="relative space-y-8">
          <header className="space-y-1 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-white/35">Gehaltsrechner</p>
            <h2 className="text-2xl font-extralight tracking-tight text-white sm:text-[1.65rem]">
              Stundenlohn <span className="font-light text-orange-400/95">kalkulieren</span>
            </h2>
            <p className="text-xs font-light text-white/45">Basis × (1 + Aufschlag) × Faktor</p>
          </header>

          <div className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">
                Basis-Stundenlohn (€)
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3.5 text-lg font-light tracking-wide text-white shadow-inner shadow-black/40 outline-none ring-0 transition-all duration-300 placeholder:text-white/25 focus:border-orange-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(234,88,12,0.12)]"
                placeholder="z. B. 30"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[11px] font-medium uppercase tracking-wider text-white/40">
                Aufschlag (%)
              </span>
              <input
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={pctInput}
                onChange={(e) => setPctInput(e.target.value)}
                className="w-full rounded-2xl border border-white/[0.09] bg-white/[0.04] px-4 py-3.5 text-lg font-light tracking-wide text-white shadow-inner shadow-black/40 outline-none transition-all duration-300 placeholder:text-white/25 focus:border-orange-500/40 focus:bg-white/[0.06] focus:shadow-[0_0_0_3px_rgba(234,88,12,0.12)]"
                placeholder="22"
              />
            </label>
          </div>

          <div>
            <p className="mb-3 text-center text-[11px] font-medium uppercase tracking-[0.2em] text-white/35">
              Multiplikator
            </p>
            <div className="grid grid-cols-4 gap-2">
              {FACTORS.map((f) => {
                const active = factor === f;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFactor(f)}
                    className={`relative rounded-xl border py-3 text-sm font-light tracking-wide transition-all duration-300 ease-out active:scale-[0.97] ${
                      active
                        ? 'border-orange-500/50 bg-gradient-to-b from-orange-500/25 to-orange-600/10 text-white shadow-[0_0_24px_-4px_rgba(234,88,12,0.45)] ring-1 ring-orange-400/30'
                        : 'border-white/[0.07] bg-white/[0.03] text-white/70 hover:border-white/15 hover:bg-white/[0.06] hover:text-white'
                    }`}
                  >
                    {f.toFixed(1)}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-4 rounded-2xl border border-white/[0.06] bg-black/35 px-5 py-5 backdrop-blur-sm">
            <div className="flex items-baseline justify-between gap-3 border-b border-white/[0.06] pb-3">
              <span className="text-[11px] font-medium uppercase tracking-wider text-white/38">Nach Aufschlag</span>
              <span className="text-right text-sm font-extralight tabular-nums text-white/80">
                {intermediate.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €
              </span>
            </div>

            <div className="text-center">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-orange-400/80">
                Final hourly rate
              </p>
              <p
                key={resultPulse}
                className="inline-block text-4xl font-extralight tabular-nums tracking-tight text-white transition-transform duration-500 ease-out motion-reduce:transition-none sm:text-[2.75rem]"
                style={{ animation: 'calcResultPop 0.45s ease-out' }}
              >
                {final.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                <span className="ml-1.5 text-2xl font-light text-white/50">€</span>
              </p>
              <p className="mt-2 text-[11px] font-light text-white/35">Finale Stundenrate</p>
            </div>
          </div>
        </div>

        <style>{`
          @keyframes calcResultPop {
            0% { opacity: 0.65; transform: scale(0.96); }
            60% { opacity: 1; transform: scale(1.02); }
            100% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    </div>
  );
};

export default HourlyRateCalculator;
