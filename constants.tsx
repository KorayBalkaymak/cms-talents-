/**
 * Sichtbarkeits-Booster / Recruiting-Keywords – Anlagenbau & Industriebau
 * Gruppen dienen der Lesbarkeit im Code; die UI nutzt die flache Liste SUGGESTED_KEYWORDS.
 */
const BOOSTER_GROUPS: string[][] = [
  // Projektmanagement & Bauleitung
  [
    'Projektmanagement',
    'Bauleitung',
    'Oberbauleitung',
    'Construction Management',
    'Site Management',
    'Projektsteuerung',
  ],
  // Ingenieurwesen
  [
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
  // Civil Engineering & Industriebau
  [
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
  // Anlagenbau & Industrie
  [
    'Anlagenbau',
    'Industrieanlagenbau',
    'Kraftwerksbau',
    'Chemieanlagenbau',
    'Raffinerie',
    'Petrochemie',
    'Offshore',
    'Onshore',
  ],
  // Schweißtechnik
  ['Schweißtechnik', 'Schweißaufsicht', 'Welding Engineering', 'Schweißplanung'],
  // Qualität & Prüfung
  ['Qualitätssicherung', 'QA/QC', 'ZfP', 'NDT', 'Inspektion', 'Prüftechnik'],
  // Montage & Baustelle
  [
    'Montage',
    'Baustellenabwicklung',
    'Rohrmontage',
    'Stahlbaumontage',
    'Field Execution',
  ],
  // Gewerke
  ['Rohrleitungsbau', 'Stahlbau', 'Brückenbau', 'Gerüstbau', 'Isoliertechnik'],
  // Elektrotechnik & EMSR
  ['Elektrotechnik', 'EMSR', 'MSR-Technik', 'Automatisierungstechnik', 'PLT'],
  // Inbetriebnahme
  [
    'Inbetriebnahme',
    'Commissioning',
    'Turnaround',
    'Shutdown',
    'Wartung',
    'Instandhaltung',
  ],
  // HSE
  ['HSE', 'Arbeitssicherheit', 'SiGeKo', 'Sicherheitsmanagement'],
  // Planung
  ['Terminplanung', 'Arbeitsvorbereitung', 'Projektcontrolling', 'Dokumentation'],
  // Software (Basis)
  ['CAD', 'BIM', 'Projektsoftware', 'ERP-Systeme'],
  // Mobilität
  ['Internationale Projekte', 'Reisebereitschaft', 'Baustellenerfahrung'],
  // Software & Digitalisierung
  [
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
];

function dedupeKeywords(groups: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const raw of group) {
      const k = raw.trim();
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(k);
    }
  }
  return out;
}

export const SUGGESTED_KEYWORDS = dedupeKeywords(BOOSTER_GROUPS);

export const INDUSTRIES = [
  'Software',
  'Finanzen',
  'Design',
  'Marketing',
  'Vertrieb',
  'HR',
  'Recht',
  'Logistik',
  'Medizin',
];

export const AVAILABILITY_OPTIONS = [
  'Sofort',
  '2 Wochen',
  '1 Monat',
  '3 Monate',
  'Nach Vereinbarung',
];
