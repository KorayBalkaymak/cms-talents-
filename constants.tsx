
import { CandidateStatus, UserRole, CandidateProfile } from './types';

export const INDUSTRIES = [
  "Software", "Finanzen", "Design", "Marketing", "Vertrieb", "HR", "Recht", "Logistik", "Medizin"
];

export const AVAILABILITY_OPTIONS = [
  "Sofort", "2 Wochen", "1 Monat", "3 Monate", "Nach Vereinbarung"
];

export const SUGGESTED_KEYWORDS = [
  "Leadership", "Agile", "Remote", "Cloud", "Architecture",
  "Deutsch C2", "English C1", "Full-Stack", "Projektmanagement",
  "Scrum Master", "DevOps", "Data Science", "Machine Learning"
];

// Demo recruiter accounts - will be auto-created on first load
export const DEMO_RECRUITERS = [
  {
    email: 'recruiter@cms.de',
    password: 'recruiter123',
    role: UserRole.RECRUITER
  },
  {
    email: 'admin@cms.de',
    password: 'admin123',
    role: UserRole.ADMIN
  }
];
