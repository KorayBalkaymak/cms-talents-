/**
 * Sichtbarkeits-Booster – Anlagenbau & Industriebau (nach Kategorien gruppiert)
 */

export type BoosterKeywordCategory = {
  title: string;
  keywords: string[];
  /** Optional: abweichender Kartenhintergrund in der Profil-UI */
  panelVariant?: 'orange';
};

function dedupeStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const k = raw.trim();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out;
}

/** Kategorien mit exakten Überschriften für die UI */
export const BOOSTER_KEYWORD_CATEGORIES: BoosterKeywordCategory[] = [
  {
    title: 'Projektmanagement & Bauleitung',
    keywords: [
      'Projektmanagement',
      'Bauleitung',
      'Oberbauleitung',
      'Construction Management',
      'Site Management',
      'Projektsteuerung',
    ],
  },
  {
    title: 'Ingenieurwesen',
    keywords: [
      'Ingenieurwesen',
      'Projektengineering',
      'Detailengineering',
      'Basic Engineering',
      'Maschinenbauingenieur',
      'Bauingenieur',
      'Verfahrensingenieur',
      'Elektroingenieur',
      'EMSR-Ingenieur',
      'Statiker',
      'Tragwerksplaner',
    ],
  },
  {
    title: 'Civil Engineering & Industriebau',
    keywords: [
      'Civil Engineering',
      'Hochbau',
      'Tiefbau',
      'Ingenieurbau',
      'Industriebau',
      'Fundamentbau',
      'Betonbau',
      'Massivbau',
      'Infrastruktur',
      'Erdbau',
      'Straßenbau',
    ],
  },
  {
    title: 'Anlagenbau & Industrie',
    keywords: [
      'Anlagenbau',
      'Industrieanlagenbau',
      'Kraftwerksbau',
      'Chemieanlagenbau',
      'Raffinerie',
      'Petrochemie',
      'Offshore',
      'Onshore',
    ],
  },
  {
    title: 'Schweißtechnik',
    keywords: ['Schweißtechnik', 'Schweißaufsicht', 'Welding Engineering', 'Schweißplanung'],
  },
  {
    title: 'Qualität & Prüfung',
    keywords: ['Qualitätssicherung', 'QA/QC', 'ZfP', 'NDT', 'Inspektion', 'Prüftechnik'],
  },
  {
    title: 'Montage & Baustelle',
    keywords: [
      'Montage',
      'Baustellenabwicklung',
      'Rohrmontage',
      'Stahlbaumontage',
      'Field Execution',
    ],
  },
  {
    title: 'Gewerke',
    keywords: ['Rohrleitungsbau', 'Stahlbau', 'Brückenbau', 'Gerüstbau', 'Isoliertechnik'],
  },
  {
    title: 'Elektrotechnik & EMSR',
    keywords: ['Elektrotechnik', 'EMSR', 'MSR-Technik', 'Automatisierungstechnik', 'PLT'],
  },
  {
    title: 'Inbetriebnahme',
    keywords: [
      'Inbetriebnahme',
      'Commissioning',
      'Turnaround',
      'Shutdown',
      'Wartung',
      'Instandhaltung',
    ],
  },
  {
    title: 'HSE',
    keywords: ['HSE', 'Arbeitssicherheit', 'SiGeKo', 'Sicherheitsmanagement'],
  },
  {
    title: 'Planung',
    keywords: ['Terminplanung', 'Arbeitsvorbereitung', 'Projektcontrolling', 'Dokumentation'],
  },
  {
    title: 'Software',
    keywords: ['CAD', 'BIM', 'Projektsoftware', 'ERP-Systeme'],
  },
  {
    title: 'Mobilität',
    keywords: ['Internationale Projekte', 'Reisebereitschaft', 'Baustellenerfahrung'],
  },
  {
    title: 'Software & Digitalisierung',
    panelVariant: 'orange',
    keywords: [
      'AutoCAD',
      'Autodesk AutoCAD',
      'Building Information Modeling',
      'Revit',
      'Navisworks',
      'MS Project',
      'Microsoft Project',
      'Primavera P6',
      'Oracle Primavera',
      'SAP',
      'SAP PM',
      'SAP MM',
      'SAP PS',
      'EPLAN',
      'COMOS',
      'Aveva',
      'Aveva E3D',
      'PDMS',
      'SolidWorks',
      'Inventor',
      'CATIA',
      'MicroStation',
      'Tekla Structures',
      'ArchiCAD',
      'Procore',
      'Aconex',
      'SharePoint',
      'Microsoft Excel',
      'Microsoft Teams',
      'Power BI',
      'Tableau',
    ],
  },
].map((cat) => ({
  title: cat.title,
  keywords: dedupeStrings(cat.keywords),
  ...(cat.panelVariant ? { panelVariant: cat.panelVariant } : {}),
}));

/** Flache Liste aller Booster-Keywords (eindeutig, Reihenfolge wie in den Kategorien) */
export const SUGGESTED_KEYWORDS = dedupeStrings(
  BOOSTER_KEYWORD_CATEGORIES.flatMap((c) => c.keywords)
);

/**
 * Hauptbranche / „Beruflicher Fokus“ (Profil, Marktplatz-Filter, Recruiter) –
 * identisch mit den Booster-Kategorie-Titeln.
 */
export const INDUSTRIES: string[] = BOOSTER_KEYWORD_CATEGORIES.map((c) => c.title);

export const AVAILABILITY_OPTIONS = [
  'Sofort',
  '2 Wochen',
  '1 Monat',
  '3 Monate',
  'Nach Vereinbarung',
];
