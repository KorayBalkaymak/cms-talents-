/** Kupfer-/Orange-Oberfläche (Gehaltsrechner, Kandidat hinzufügen, …) */
export const COPPER_PANEL =
  'border-orange-500/50 bg-[#0a0a0c] bg-gradient-to-b from-orange-500/25 to-orange-600/10 shadow-[0_0_28px_-2px_rgba(234,88,12,0.5),0_25px_60px_-20px_rgba(0,0,0,0.75)] ring-1 ring-orange-400/30';

/** Stärkerer Verlauf (z. B. aktiver Multiplikator im Rechner) */
export const COPPER_PANEL_ACTIVE =
  'border-orange-400/70 bg-[#0a0a0c] bg-gradient-to-b from-orange-500/45 to-orange-600/25 shadow-[0_0_32px_-2px_rgba(234,88,12,0.65)] ring-2 ring-orange-300/50';

/** Akzentfarbe „Talents“ / Hero-Zeile (wie Gehaltsrechner) */
export const COPPER_TEXT =
  'bg-gradient-to-b from-orange-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_0_22px_rgba(234,88,12,0.45)]';

/**
 * Hero-CTAs: Fläche wie COPPER_PANEL_ACTIVE (Gehaltsrechner), aber ohne äußeren Orange-Glow/Ring („LED“).
 * Schatten nur neutral für Tiefe.
 */
export const COPPER_BUTTON =
  '!rounded-lg !border !border-orange-400/70 !bg-[#0a0a0c] !bg-gradient-to-b !from-orange-500/45 !to-orange-600/25 !text-white !shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_8px_26px_rgba(0,0,0,0.55)] hover:!from-orange-500/52 hover:!to-orange-600/32 hover:!shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_10px_30px_rgba(0,0,0,0.58)] active:!translate-y-px active:!brightness-[0.97] active:!shadow-[inset_0_2px_12px_rgba(0,0,0,0.55)]';
