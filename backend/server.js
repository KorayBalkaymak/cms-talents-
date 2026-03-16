// =====================================================
// CMS TALENTS - EXPRESS API SERVER
// =====================================================

import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import { v4 as uuid } from 'uuid';
import { initDatabase, query, queryOne, run, saveDatabase } from './database.js';

const app = express();
const PORT = process.env.PORT || 3001;
const IS_VERCEL = !!process.env.VERCEL;

// =====================================================
// Recruiter Access (Allowlist)
// =====================================================
const RECRUITER_FIXED_PASSWORD = 'A123';
const RECRUITER_ALLOWLIST = new Set([
    'haagen@industries-cms.com',
    'candau@industries-cms.com',
    'fuhrmann@industries-cms.com'
]);

async function ensureAllowlistedRecruiters() {
    // On Vercel we don't rely on ephemeral DB; allowlist only matters locally.
    // Seed/update allowlisted recruiter accounts so login works immediately.
    for (const email of RECRUITER_ALLOWLIST) {
        const existing = await queryOne('SELECT id FROM users WHERE email = ?', [email]);
        const passwordHash = bcrypt.hashSync(RECRUITER_FIXED_PASSWORD, 10);
        if (!existing) {
            const userId = uuid();
            await run(
                'INSERT INTO users (id, email, password_hash, role, email_verified, verification_token, verification_token_expires_at) VALUES (?, ?, ?, ?, 1, NULL, NULL)',
                [userId, email, passwordHash, 'recruiter']
            );
        } else {
            await run(
                'UPDATE users SET password_hash = ?, role = ?, email_verified = 1, verification_token = NULL, verification_token_expires_at = NULL WHERE email = ?',
                [passwordHash, 'recruiter', email]
            );
        }
    }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Vercel: Request-Pfad kann ohne /api ankommen (z. B. /auth/register) – für Routen-Matching normalisieren
if (IS_VERCEL) {
    app.use((req, res, next) => {
        const p = req.path || req.url?.split('?')[0] || '';
        if (p && p !== '/' && !p.startsWith('/api')) {
            const q = req.originalUrl?.indexOf('?');
            req.url = '/api' + p + (q >= 0 ? req.originalUrl.substring(q) : '');
        }
        next();
    });
}

// Wait for database to initialize
let dbReady = false;
let dbInitError = null;
let dbReadyResolve;
const dbReadyPromise = new Promise((resolve) => { dbReadyResolve = resolve; });

initDatabase()
    .then(async () => {
        try {
            await ensureAllowlistedRecruiters();
        } catch (e) {
            console.error('[RecruiterSeed] failed:', e);
        }
        dbReady = true;
        if (dbReadyResolve) dbReadyResolve();
    })
    .catch((e) => {
        dbInitError = e;
        console.error('[DB] init failed:', e);
        if (dbReadyResolve) dbReadyResolve(); // Auflösen, damit wartende Requests die Fehlerantwort bekommen
    });

const DB_WAIT_MS = 25000; // Cold Start (z. B. Vercel): bis zu 25s auf DB warten

// Database ready check middleware – wartet bei Cold Start auf DB, damit Registrierung/Login funktioniert
app.use(async (req, res, next) => {
    if (req.path === '/api/health') {
        return res.status(dbReady ? 200 : (dbInitError ? 500 : 503)).json({
            ok: dbReady,
            dbReady,
            error: dbInitError ? String(dbInitError?.message || dbInitError) : undefined,
            env: {
                VERCEL: !!process.env.VERCEL,
                POSTGRES_URL: !!process.env.POSTGRES_URL,
                DATABASE_URL: !!process.env.DATABASE_URL,
                PRISMA_DATABASE_URL: !!process.env.PRISMA_DATABASE_URL
            }
        });
    }
    if (!dbReady) {
        try {
            await Promise.race([
                dbReadyPromise,
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), DB_WAIT_MS))
            ]);
        } catch (_) {
            // Timeout oder Promise abgeschlossen mit Fehler
        }
    }
    if (!dbReady) {
        if (dbInitError) {
            const details = String(dbInitError?.message || dbInitError);
            const code = (dbInitError && typeof dbInitError === 'object' && 'code' in dbInitError) ? String(dbInitError.code) : undefined;
            const onVercel = !!process.env.VERCEL;
            const hasDbUrl = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.PRISMA_DATABASE_URL);
            let errorMessage;
            if (onVercel && !hasDbUrl) {
                errorMessage = 'DATABASE_URL kommt auf Vercel nicht an. Bitte: (1) Vercel → Projekt → Settings → Environment Variables. (2) Name: DATABASE_URL, Value: Ihre Supabase-URL (Transaction Pooler, Port 6543). (3) Für Production und Preview aktivieren, Speichern. (4) Deployments → bei letztem Deployment „Redeploy“ klicken.';
            } else if (onVercel && hasDbUrl) {
                errorMessage = 'Datenbank-Verbindung schlägt fehl (Supabase). Prüfen: Passwort in DATABASE_URL korrekt? Supabase-Projekt läuft? Details: ' + details;
            } else if (!onVercel) {
                errorMessage = 'Backend (Datenbank) nicht konfiguriert. Lokal: .env mit DATABASE_URL anlegen und Backend neu starten.';
            } else {
                errorMessage = 'Datenbank nicht erreichbar. Bitte DATABASE_URL oder POSTGRES_URL in Vercel (Environment Variables) setzen und neu deployen.';
            }
            return res.status(500).json({
                error: errorMessage,
                details,
                code,
                env: {
                    VERCEL: onVercel,
                    DATABASE_URL_set: !!process.env.DATABASE_URL,
                    POSTGRES_URL_set: !!process.env.POSTGRES_URL,
                    PRISMA_DATABASE_URL_set: !!process.env.PRISMA_DATABASE_URL
                },
                hint: onVercel ? 'Health-Check: Diese App-URL/api/health im Browser öffnen – zeigt ob DATABASE_URL ankommt.' : 'Für Vercel: POSTGRES_URL oder DATABASE_URL setzen.'
            });
        }
        return res.status(503).json({ error: 'Server startet noch. Bitte in wenigen Sekunden erneut versuchen.' });
    }
    next();
});

// =====================================================
// AUTH ENDPOINTS
// =====================================================

// E-Mail-Verifizierung: Token gültig 24 Stunden
function generateVerificationToken() {
    return uuid() + uuid().replace(/-/g, '');
}
function tokenExpiryHours(hours = 24) {
    const d = new Date();
    d.setHours(d.getHours() + hours);
    return d.toISOString();
}

// Register new user (Account erst nach E-Mail-Bestätigung nutzbar)
async function handleRegister(req, res) {
    try {
        const { email, password, role: bodyRole } = req.body || {};
        const role = (bodyRole && ['candidate', 'recruiter'].includes(bodyRole)) ? bodyRole : 'candidate';

        if (!email || !password) {
            return res.status(400).json({ error: 'Email und Passwort erforderlich' });
        }
        const emailTrimmed = String(email).trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
            return res.status(400).json({ error: 'Bitte geben Sie eine gültige E-Mail-Adresse ein.' });
        }
        if (password.length < 8) {
            return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
        }

        if (role === 'recruiter') {
            return res.status(403).json({
                error: 'Recruiter-Registrierung ist deaktiviert.',
                hint: 'Bitte mit einer freigeschalteten Recruiter-E-Mail einloggen.'
            });
        }

        const existing = await queryOne('SELECT id FROM users WHERE email = ?', [emailTrimmed]);
        if (existing) {
            return res.status(400).json({ error: 'Diese E-Mail ist bereits registriert' });
        }

        const userId = uuid();
        const passwordHash = bcrypt.hashSync(password, 10);
        const verificationToken = generateVerificationToken();
        const verificationExpires = tokenExpiryHours(24);

        const userInserted = await run(
            'INSERT INTO users (id, email, password_hash, role, email_verified, verification_token, verification_token_expires_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
            [userId, emailTrimmed, passwordHash, role, verificationToken, verificationExpires]
        );
        if (!userInserted) {
            return res.status(500).json({ error: 'Registrierung fehlgeschlagen (Benutzer)' });
        }

        if (role === 'candidate') {
            const profileInserted = await run('INSERT INTO candidate_profiles (user_id, avatar_seed) VALUES (?, ?)',
                [userId, userId.substring(0, 8)]);
            if (!profileInserted) {
                await run('DELETE FROM users WHERE id = ?', [userId]);
                return res.status(500).json({ error: 'Profil konnte nicht angelegt werden. Bitte erneut versuchen.' });
            }
        }

        if (IS_VERCEL) {
            // Auf Vercel: sofort verifizieren und einloggen (kein persistenter Speicher)
            await run('UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires_at = NULL WHERE id = ?', [userId]);
            res.json({
                success: true,
                user: {
                    id: userId,
                    email: emailTrimmed,
                    role: role,
                    createdAt: new Date().toISOString()
                }
            });
        } else {
            // Lokal: E-Mail-Bestätigung erforderlich
            res.json({
                success: true,
                message: 'Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen zugesendet haben.',
                verificationToken
            });
        }
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
    }
}
app.post('/api/auth/register', (req, res) => handleRegister(req, res));
app.post('/auth/register', (req, res) => handleRegister(req, res)); // Vercel: Pfad oft ohne /api

// E-Mail bestätigen (Link mit Token)
app.get('/api/auth/verify-email', async (req, res) => {
    try {
        const tokenRaw = req.query.token;
        const token = Array.isArray(tokenRaw) ? tokenRaw[0] : tokenRaw;
        const tokenTrimmed = token ? String(token).trim() : '';
        if (!tokenTrimmed) {
            return res.status(400).json({ success: false, error: 'Token fehlt' });
        }
        const user = await queryOne(
          'SELECT id, email_verified, verification_token_expires_at FROM users WHERE verification_token = ?',
          [tokenTrimmed]
        );
        if (!user) {
            return res.status(400).json({ success: false, error: 'Ungültiger oder abgelaufener Link.' });
        }
        if (user.verification_token_expires_at) {
            const exp = new Date(user.verification_token_expires_at);
            if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
            return res.status(400).json({ success: false, error: 'Der Bestätigungslink ist abgelaufen. Bitte registrieren Sie sich erneut.' });
            }
        }
        // Idempotent: Link darf mehrfach geklickt/geladen werden, ohne "Ungültig"-Fehler.
        // Wir behalten den Token, löschen aber das Ablaufdatum.
        await run('UPDATE users SET email_verified = 1, verification_token_expires_at = NULL WHERE id = ?', [user.id]);
        res.json({ success: true, message: 'E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.' });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ success: false, error: 'Bestätigung fehlgeschlagen' });
    }
});

// Login (nur wenn E-Mail bestätigt)
async function handleLogin(req, res) {
    try {
        const { email, password, expectedRole } = req.body || {};

        if (!email || !password) {
            return res.status(400).json({ error: 'Email und Passwort erforderlich' });
        }

        const emailTrimmed = String(email).trim().toLowerCase();

        // Recruiter dashboard: only allow allowlisted emails + fixed password.
        if (expectedRole === 'recruiter') {
            if (!RECRUITER_ALLOWLIST.has(emailTrimmed)) {
                return res.status(403).json({ error: 'Dieser Recruiter-Account ist nicht freigeschaltet.' });
            }
            // Create user on-demand if missing (e.g. fresh DB)
            const existing = await queryOne('SELECT * FROM users WHERE email = ?', [emailTrimmed]);
            if (!existing) {
                if (String(password) !== RECRUITER_FIXED_PASSWORD) {
                    return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
                }
                const userId = uuid();
                const passwordHash = bcrypt.hashSync(RECRUITER_FIXED_PASSWORD, 10);
                await run(
                    'INSERT INTO users (id, email, password_hash, role, email_verified, verification_token, verification_token_expires_at) VALUES (?, ?, ?, ?, 1, NULL, NULL)',
                    [userId, emailTrimmed, passwordHash, 'recruiter']
                );
            }
        }

        const user = await queryOne('SELECT * FROM users WHERE email = ?', [emailTrimmed]);
        if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        if (!IS_VERCEL) {
            const verified = user.email_verified == 1;
            if (!verified) {
                // Token ggf. erneuern, damit Login-Screen direkt einen Bestätigungslink anzeigen kann
                let token = user.verification_token;
                const exp = user.verification_token_expires_at ? new Date(user.verification_token_expires_at) : null;
                const expired = exp ? (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) : false;
                if (!token || expired) {
                    token = generateVerificationToken();
                    const expires = tokenExpiryHours(24);
                    await run('UPDATE users SET verification_token = ?, verification_token_expires_at = ? WHERE id = ?', [token, expires, user.id]);
                }

                return res.status(403).json({
                    error: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Klicken Sie auf den Bestätigungslink, um sich anschließend anzumelden.',
                    needsVerification: true,
                    verificationToken: token
                });
            }
        }

        if (expectedRole && user.role !== expectedRole && user.role !== 'recruiter_admin') {
            return res.status(403).json({ error: 'Keine Berechtigung für diesen Bereich' });
        }

        res.json({
            success: true,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                createdAt: user.created_at
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Anmeldung fehlgeschlagen' });
    }
}
app.post('/api/auth/login', (req, res) => handleLogin(req, res));
app.post('/auth/login', (req, res) => handleLogin(req, res)); // Vercel: Pfad kann ohne /api ankommen

// Konto löschen (DSGVO): Kandidat kann sich selbst löschen (Passwort erforderlich)
app.post('/api/auth/delete-account', async (req, res) => {
    try {
        const { email, password } = req.body || {};
        if (!email || !password) {
            return res.status(400).json({ error: 'Email und Passwort erforderlich' });
        }
        const emailTrimmed = String(email).trim().toLowerCase();
        const user = await queryOne('SELECT id, email, role, password_hash FROM users WHERE email = ?', [emailTrimmed]);
        if (!user) return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        if (String(user.role) !== 'candidate') {
            return res.status(403).json({ error: 'Nur Kandidaten können ihren Account hier löschen.' });
        }

        const validPassword = bcrypt.compareSync(String(password), user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        const userId = user.id;

        // Alle Kandidaten-Daten entfernen
        await run('DELETE FROM candidate_skills WHERE user_id = ?', [userId]);
        await run('DELETE FROM candidate_keywords WHERE user_id = ?', [userId]);
        await run('DELETE FROM candidate_social_links WHERE user_id = ?', [userId]);
        await run('DELETE FROM candidate_documents WHERE user_id = ?', [userId]);
        await run('DELETE FROM candidate_profiles WHERE user_id = ?', [userId]);

        // Audit-Logs mit Bezug auf den User entfernen (DSGVO)
        await run('DELETE FROM audit_log WHERE target_id = ? OR performer_id = ?', [userId, userId]);

        // User entfernen
        await run('DELETE FROM users WHERE id = ?', [userId]);

        res.json({ success: true });
    } catch (error) {
        console.error('Delete account error:', error);
        res.status(500).json({ error: 'Konto konnte nicht gelöscht werden.' });
    }
});

// =====================================================
// CANDIDATE ENDPOINTS
// =====================================================

async function enrichCandidate(row) {
    if (!row) return null;

    const skills = await query('SELECT skill FROM candidate_skills WHERE user_id = ?', [row.user_id]);
    const keywords = await query('SELECT keyword FROM candidate_keywords WHERE user_id = ?', [row.user_id]);
    const links = await query('SELECT label, url FROM candidate_social_links WHERE user_id = ?', [row.user_id]);
    const docRows = await query('SELECT doc_type, file_name FROM candidate_documents WHERE user_id = ?', [row.user_id]);
    const documents = docRows.map(d => ({ type: d.doc_type, name: d.file_name }));

    return {
        userId: row.user_id,
        firstName: row.first_name,
        lastName: row.last_name,
        city: row.city,
        country: row.country,
        address: row.address || null,
        zipCode: row.zip_code || null,
        phoneNumber: row.phone_number || null,
        industry: row.industry,
        experienceYears: row.experience_years,
        availability: row.availability,
        birthYear: row.birth_year,
        about: row.about,
        profileImageUrl: row.profile_image_url,
        avatarSeed: row.avatar_seed,
        status: row.status,
        isPublished: row.is_published === 1,
        isSubmitted: row.submitted_to_recruiter === 1,
        cvReviewedAt: row.cv_reviewed_at || null,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        skills: skills.map(s => s.skill),
        boostedKeywords: keywords.map(k => k.keyword),
        socialLinks: links,
        documents
    };
}

// Get published candidates – öffentlich, für alle (Zuschauer, Kunden, Interessenten), kein Recruiter-Login nötig
app.get('/api/candidates', async (req, res) => {
    try {
        const candidates = await query(`SELECT * FROM candidate_profiles WHERE is_published = 1 AND status = 'aktiv'`);
        const enriched = await Promise.all(candidates.map((c) => enrichCandidate(c)));
        res.json(enriched);
    } catch (error) {
        console.error('Get candidates error:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Kandidaten' });
    }
});

// Get all candidates (admin)
app.get('/api/candidates/all', async (req, res) => {
    try {
        const candidates = await query('SELECT * FROM candidate_profiles');
        const enriched = await Promise.all(candidates.map((c) => enrichCandidate(c)));
        res.json(enriched);
    } catch (error) {
        console.error('Get all candidates error:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Kandidaten' });
    }
});

// Get single candidate (legt Profil an, falls User Kandidat ist aber noch kein Profil hat)
app.get('/api/candidates/:userId', async (req, res) => {
    try {
        let candidate = await queryOne('SELECT * FROM candidate_profiles WHERE user_id = ?', [req.params.userId]);
        if (!candidate) {
            const user = await queryOne('SELECT id, role FROM users WHERE id = ?', [req.params.userId]);
            if (user && user.role === 'candidate') {
                await run('INSERT INTO candidate_profiles (user_id, avatar_seed) VALUES (?, ?)',
                    [req.params.userId, req.params.userId.substring(0, 8)]);
                candidate = await queryOne('SELECT * FROM candidate_profiles WHERE user_id = ?', [req.params.userId]);
            }
        }
        if (!candidate) {
            return res.status(404).json({ error: 'Kandidat nicht gefunden' });
        }
        res.json(await enrichCandidate(candidate));
    } catch (error) {
        console.error('Get candidate error:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Kandidaten' });
    }
});

// Create/Update candidate profile
app.put('/api/candidates/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const data = req.body;

        const existing = await queryOne('SELECT user_id, status, is_published FROM candidate_profiles WHERE user_id = ?', [userId]);

        // Publish/Status dürfen nicht "einfach so" über PUT gesetzt werden.
        // Veröffentlichung läuft ausschließlich über die Admin-Aktion "publish" (mit CV-Review-Gate).
        const existingIsPublished = existing ? (existing.is_published === 1 ? 1 : 0) : 0;
        const existingStatus = existing ? String(existing.status || 'in Prüfung') : 'in Prüfung';
        const wantsSubmit = !!data.isSubmitted;
        const submittedFlag = wantsSubmit ? 1 : 0;
        const statusToStore = wantsSubmit ? 'in Prüfung' : (
            // Block: Aktiv-Status darf nicht über PUT gesetzt werden (nur via "publish")
            (String(data.status || '') === 'aktiv' && existingStatus !== 'aktiv') ? existingStatus : (data.status || existingStatus || 'in Prüfung')
        );

        if (existing) {
            await run(`UPDATE candidate_profiles SET
          first_name = ?, last_name = ?, city = ?, country = ?,
          address = ?, zip_code = ?, phone_number = ?,
          industry = ?, experience_years = ?, availability = ?,
          birth_year = ?, about = ?, profile_image_url = ?,
          status = ?, is_published = ?, submitted_to_recruiter = ?, updated_at = datetime('now')
        WHERE user_id = ?`,
                [
                    data.firstName || '', data.lastName || '', data.city || '', data.country || '',
                    data.address || null, data.zipCode || null, data.phoneNumber || null,
                    data.industry || '', data.experienceYears || 0, data.availability || '',
                    data.birthYear || null, data.about || null, data.profileImageUrl || null,
                    statusToStore, existingIsPublished, submittedFlag, userId
                ]);
        } else {
            await run(`INSERT INTO candidate_profiles (
          user_id, first_name, last_name, city, country, address, zip_code, phone_number,
          industry, experience_years, availability, birth_year, about,
          profile_image_url, avatar_seed, status, is_published, submitted_to_recruiter
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, data.firstName || '', data.lastName || '', data.city || '', data.country || '',
                    data.address || null, data.zipCode || null, data.phoneNumber || null,
                    data.industry || '', data.experienceYears || 0, data.availability || '',
                    data.birthYear || null, data.about || null, data.profileImageUrl || null,
                    userId.substring(0, 8), statusToStore, 0, submittedFlag
                ]);
        }

        // Update skills
        await run('DELETE FROM candidate_skills WHERE user_id = ?', [userId]);
        for (const skill of (data.skills || [])) {
            await run('INSERT OR IGNORE INTO candidate_skills (user_id, skill) VALUES (?, ?)', [userId, skill]);
        }

        // Update keywords
        await run('DELETE FROM candidate_keywords WHERE user_id = ?', [userId]);
        for (const keyword of (data.boostedKeywords || [])) {
            await run('INSERT OR IGNORE INTO candidate_keywords (user_id, keyword) VALUES (?, ?)', [userId, keyword]);
        }

        // Update social links
        await run('DELETE FROM candidate_social_links WHERE user_id = ?', [userId]);
        for (const link of (data.socialLinks || [])) {
            await run('INSERT INTO candidate_social_links (user_id, label, url) VALUES (?, ?, ?)', [userId, link.label, link.url]);
        }

        const updated = await queryOne('SELECT * FROM candidate_profiles WHERE user_id = ?', [userId]);
        res.json(await enrichCandidate(updated));

    } catch (error) {
        console.error('Update candidate error:', error);
        res.status(500).json({ error: 'Fehler beim Speichern des Profils' });
    }
});

// Admin action
app.post('/api/candidates/:userId/admin', async (req, res) => {
    try {
        const { userId } = req.params;
        const { action, newStatus, performerId } = req.body;

        if (action === 'delete') {
            await run('DELETE FROM candidate_skills WHERE user_id = ?', [userId]);
            await run('DELETE FROM candidate_keywords WHERE user_id = ?', [userId]);
            await run('DELETE FROM candidate_social_links WHERE user_id = ?', [userId]);
            await run('DELETE FROM candidate_documents WHERE user_id = ?', [userId]);
            await run('DELETE FROM candidate_profiles WHERE user_id = ?', [userId]);
            await run('DELETE FROM users WHERE id = ?', [userId]);

            await run('INSERT INTO audit_log (id, action, performer_id, target_id) VALUES (?, ?, ?, ?)',
                [uuid(), 'Kandidat gelöscht', performerId || 'unknown', userId]);

            res.json({ success: true });
        } else if (action === 'status' && newStatus) {
            await run('UPDATE candidate_profiles SET status = ?, updated_at = datetime("now") WHERE user_id = ?',
                [newStatus, userId]);

            await run('INSERT INTO audit_log (id, action, performer_id, target_id) VALUES (?, ?, ?, ?)',
                [uuid(), `Status geändert zu "${newStatus}"`, performerId || 'unknown', userId]);

            res.json({ success: true });
        } else if (action === 'cv_reviewed') {
            const hasCv = await queryOne(
                'SELECT id FROM candidate_documents WHERE user_id = ? AND doc_type = ? LIMIT 1',
                [userId, 'cv']
            );
            if (!hasCv) {
                return res.status(400).json({ error: 'Kein Lebenslauf vorhanden. Bitte erst CV hochladen.' });
            }

            await run(
                'UPDATE candidate_profiles SET cv_reviewed_at = datetime("now"), cv_reviewed_by = ?, updated_at = datetime("now") WHERE user_id = ?',
                [performerId || 'unknown', userId]
            );

            await run('INSERT INTO audit_log (id, action, performer_id, target_id) VALUES (?, ?, ?, ?)',
                [uuid(), 'Lebenslauf geprüft', performerId || 'unknown', userId]);

            res.json({ success: true });
        } else if (action === 'publish') {
            const profile = await queryOne('SELECT submitted_to_recruiter, cv_reviewed_at FROM candidate_profiles WHERE user_id = ?', [userId]);
            if (!profile) return res.status(404).json({ error: 'Kandidat nicht gefunden' });
            // Legacy-Support: ältere Profile können bereits "aktiv" sein, aber nicht veröffentlicht.
            if (profile.submitted_to_recruiter !== 1) {
                const st = await queryOne('SELECT status, is_published FROM candidate_profiles WHERE user_id = ?', [userId]);
                const canLegacyPublish = st && String(st.status) === 'aktiv' && (st.is_published !== 1);
                if (!canLegacyPublish) {
                    return res.status(400).json({ error: 'Profil ist nicht eingereicht. Bitte zuerst "Zum Recruiter senden".' });
                }
            }
            if (!profile.cv_reviewed_at) {
                return res.status(400).json({ error: 'Lebenslauf wurde noch nicht geprüft. Bitte CV ansehen und prüfen.' });
            }
            const hasCv = await queryOne(
                'SELECT id FROM candidate_documents WHERE user_id = ? AND doc_type = ? LIMIT 1',
                [userId, 'cv']
            );
            if (!hasCv) {
                return res.status(400).json({ error: 'Kein Lebenslauf vorhanden. Bitte erst CV hochladen.' });
            }

            await run('UPDATE candidate_profiles SET status = ?, is_published = 1, updated_at = datetime("now") WHERE user_id = ?',
                ['aktiv', userId]);
            await run('UPDATE candidate_profiles SET submitted_to_recruiter = 0 WHERE user_id = ?', [userId]);

            await run('INSERT INTO audit_log (id, action, performer_id, target_id) VALUES (?, ?, ?, ?)',
                [uuid(), 'Profil veröffentlicht (freigegeben)', performerId || 'unknown', userId]);

            res.json({ success: true });
        } else {
            res.status(400).json({ error: 'Ungültige Aktion' });
        }
    } catch (error) {
        console.error('Admin action error:', error);
        res.status(500).json({ error: 'Admin-Aktion fehlgeschlagen' });
    }
});

// =====================================================
// DOCUMENT ENDPOINTS
// =====================================================

app.get('/api/documents/:userId', async (req, res) => {
    try {
        const docs = await query('SELECT * FROM candidate_documents WHERE user_id = ?', [req.params.userId]);

        const result = { userId: req.params.userId, cvPdf: null, certificates: [], qualifications: [] };

        for (const doc of docs) {
            const item = { name: doc.file_name, data: doc.file_data };
            if (doc.doc_type === 'cv') result.cvPdf = item;
            else if (doc.doc_type === 'certificate') result.certificates.push(item);
            else if (doc.doc_type === 'qualification') result.qualifications.push(item);
        }

        res.json(result);
    } catch (error) {
        console.error('Get documents error:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Dokumente' });
    }
});

app.put('/api/documents/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const { cvPdf, certificates, qualifications } = req.body;

        await run('DELETE FROM candidate_documents WHERE user_id = ?', [userId]);

        if (cvPdf) {
            await run('INSERT INTO candidate_documents (user_id, doc_type, file_name, file_data) VALUES (?, ?, ?, ?)',
                [userId, 'cv', cvPdf.name, cvPdf.data]);
        }

        for (const cert of (certificates || [])) {
            await run('INSERT INTO candidate_documents (user_id, doc_type, file_name, file_data) VALUES (?, ?, ?, ?)',
                [userId, 'certificate', cert.name, cert.data]);
        }

        for (const qual of (qualifications || [])) {
            await run('INSERT INTO candidate_documents (user_id, doc_type, file_name, file_data) VALUES (?, ?, ?, ?)',
                [userId, 'qualification', qual.name, qual.data]);
        }

        // Any document change can invalidate prior CV review (e.g. CV replaced/removed)
        await run(
            'UPDATE candidate_profiles SET cv_reviewed_at = NULL, cv_reviewed_by = NULL, updated_at = datetime("now") WHERE user_id = ?',
            [userId]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Save documents error:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Dokumente' });
    }
});

// =====================================================
// AUDIT LOG
// =====================================================

app.get('/api/audit-log', async (req, res) => {
    try {
        const logs = await query('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100');
        res.json(logs.map(l => ({
            id: l.id,
            action: l.action,
            performerId: l.performer_id,
            targetId: l.target_id,
            timestamp: l.timestamp
        })));
    } catch (error) {
        console.error('Get audit log error:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Audit-Logs' });
    }
});

// =====================================================
// START SERVER
// =====================================================

// Start Server only if not running in Vercel (serverless)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(PORT, () => {
        console.log(`
╔════════════════════════════════════════════════════╗
║  CMS TALENTS BACKEND                               ║
║  Server running on http://localhost:${PORT}           ║
║  Database: SQLite (cms_talents.db)                 ║
╚════════════════════════════════════════════════════╝
      `);
    });
}

export default app;
