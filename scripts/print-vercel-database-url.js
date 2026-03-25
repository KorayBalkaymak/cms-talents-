#!/usr/bin/env node
// Liest .env und gibt die DATABASE_URL zum Kopieren für Vercel aus.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');
const envPath = path.join(rootDir, '.env');
if (!fs.existsSync(envPath)) {
  console.error('Keine .env gefunden. Bitte .env mit DATABASE_URL anlegen.');
  process.exit(1);
}
const content = fs.readFileSync(envPath, 'utf8');
let url = '';
for (const line of content.split('\n')) {
  const m = line.match(/^\s*DATABASE_URL\s*=\s*(.*)$/);
  if (m) {
    url = m[1].trim().replace(/^["']|["']$/g, '');
    break;
  }
}
if (!url) {
  console.error('DATABASE_URL nicht in .env gefunden.');
  process.exit(1);
}
console.log('Kopieren Sie die folgende Zeile und fügen Sie sie in Vercel ein:');
console.log('');
console.log('Name:  DATABASE_URL');
console.log('Value: (siehe unten)');
console.log('');
console.log(url);
console.log('');
console.log('Vercel: Projekt → Settings → Environment Variables → Add New');
console.log('Für "Production" und "Preview" aktivieren, dann Speichern und Redeploy.');
