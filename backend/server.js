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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Wait for database to initialize
let dbReady = false;
initDatabase().then(() => {
    dbReady = true;
});

// Database ready check middleware
app.use((req, res, next) => {
    if (!dbReady) {
        return res.status(503).json({ error: 'Database initializing...' });
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
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, role } = req.body;

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
        if (!['candidate', 'recruiter'].includes(role)) {
            return res.status(400).json({ error: 'Ungültige Rolle' });
        }

        const existing = queryOne('SELECT id FROM users WHERE email = ?', [emailTrimmed]);
        if (existing) {
            return res.status(400).json({ error: 'Diese E-Mail ist bereits registriert' });
        }

        const userId = uuid();
        const passwordHash = bcrypt.hashSync(password, 10);
        const verificationToken = generateVerificationToken();
        const verificationExpires = tokenExpiryHours(24);

        const userInserted = run(
            'INSERT INTO users (id, email, password_hash, role, email_verified, verification_token, verification_token_expires_at) VALUES (?, ?, ?, ?, 0, ?, ?)',
            [userId, emailTrimmed, passwordHash, role, verificationToken, verificationExpires]
        );
        if (!userInserted) {
            return res.status(500).json({ error: 'Registrierung fehlgeschlagen (Benutzer)' });
        }

        if (role === 'candidate') {
            const profileInserted = run('INSERT INTO candidate_profiles (user_id, avatar_seed) VALUES (?, ?)',
                [userId, userId.substring(0, 8)]);
            if (!profileInserted) {
                run('DELETE FROM users WHERE id = ?', [userId]);
                return res.status(500).json({ error: 'Profil konnte nicht angelegt werden. Bitte erneut versuchen.' });
            }
        }

        // Kein Auto-Login: User muss E-Mail bestätigen. Link wird an Frontend übergeben (oder per E-Mail versendet).
        res.json({
            success: true,
            message: 'Registrierung erfolgreich. Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen zugesendet haben.',
            verificationToken
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({ error: 'Registrierung fehlgeschlagen' });
    }
});

// E-Mail bestätigen (Link mit Token)
app.get('/api/auth/verify-email', (req, res) => {
    try {
        const { token } = req.query;
        if (!token) {
            return res.status(400).json({ success: false, error: 'Token fehlt' });
        }
        const user = queryOne('SELECT id, email_verified, verification_token_expires_at FROM users WHERE verification_token = ?', [token]);
        if (!user) {
            return res.status(400).json({ success: false, error: 'Ungültiger oder abgelaufener Link.' });
        }
        const now = new Date().toISOString();
        if (user.verification_token_expires_at && user.verification_token_expires_at < now) {
            return res.status(400).json({ success: false, error: 'Der Bestätigungslink ist abgelaufen. Bitte registrieren Sie sich erneut.' });
        }
        run('UPDATE users SET email_verified = 1, verification_token = NULL, verification_token_expires_at = NULL WHERE id = ?', [user.id]);
        res.json({ success: true, message: 'E-Mail-Adresse bestätigt. Sie können sich jetzt anmelden.' });
    } catch (error) {
        console.error('Verify email error:', error);
        res.status(500).json({ success: false, error: 'Bestätigung fehlgeschlagen' });
    }
});

// Login (nur wenn E-Mail bestätigt)
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password, expectedRole } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email und Passwort erforderlich' });
        }

        const user = queryOne('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
        if (!user) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        const validPassword = bcrypt.compareSync(password, user.password_hash);
        if (!validPassword) {
            return res.status(401).json({ error: 'Ungültige Anmeldedaten' });
        }

        const verified = user.email_verified == 1;
        if (!verified) {
            return res.status(403).json({
                error: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse. Sie haben einen Link per E-Mail erhalten – klicken Sie darauf, um sich anschließend anzumelden.',
                needsVerification: true
            });
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
});

// =====================================================
// CANDIDATE ENDPOINTS
// =====================================================

function enrichCandidate(row) {
    if (!row) return null;

    const skills = query('SELECT skill FROM candidate_skills WHERE user_id = ?', [row.user_id]);
    const keywords = query('SELECT keyword FROM candidate_keywords WHERE user_id = ?', [row.user_id]);
    const links = query('SELECT label, url FROM candidate_social_links WHERE user_id = ?', [row.user_id]);
    const docRows = query('SELECT doc_type, file_name FROM candidate_documents WHERE user_id = ?', [row.user_id]);
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
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        skills: skills.map(s => s.skill),
        boostedKeywords: keywords.map(k => k.keyword),
        socialLinks: links,
        documents
    };
}

// Get published candidates – öffentlich, für alle (Zuschauer, Kunden, Interessenten), kein Recruiter-Login nötig
app.get('/api/candidates', (req, res) => {
    try {
        const candidates = query(`SELECT * FROM candidate_profiles WHERE is_published = 1 AND status = 'aktiv'`);
        res.json(candidates.map(c => enrichCandidate(c)));
    } catch (error) {
        console.error('Get candidates error:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Kandidaten' });
    }
});

// Get all candidates (admin)
app.get('/api/candidates/all', (req, res) => {
    try {
        const candidates = query('SELECT * FROM candidate_profiles');
        res.json(candidates.map(c => enrichCandidate(c)));
    } catch (error) {
        console.error('Get all candidates error:', error);
        res.status(500).json({ error: 'Fehler beim Laden der Kandidaten' });
    }
});

// Get single candidate (legt Profil an, falls User Kandidat ist aber noch kein Profil hat)
app.get('/api/candidates/:userId', (req, res) => {
    try {
        let candidate = queryOne('SELECT * FROM candidate_profiles WHERE user_id = ?', [req.params.userId]);
        if (!candidate) {
            const user = queryOne('SELECT id, role FROM users WHERE id = ?', [req.params.userId]);
            if (user && user.role === 'candidate') {
                run('INSERT INTO candidate_profiles (user_id, avatar_seed) VALUES (?, ?)',
                    [req.params.userId, req.params.userId.substring(0, 8)]);
                candidate = queryOne('SELECT * FROM candidate_profiles WHERE user_id = ?', [req.params.userId]);
            }
        }
        if (!candidate) {
            return res.status(404).json({ error: 'Kandidat nicht gefunden' });
        }
        res.json(enrichCandidate(candidate));
    } catch (error) {
        console.error('Get candidate error:', error);
        res.status(500).json({ error: 'Fehler beim Laden des Kandidaten' });
    }
});

// Create/Update candidate profile
app.put('/api/candidates/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const data = req.body;

        const existing = queryOne('SELECT user_id FROM candidate_profiles WHERE user_id = ?', [userId]);

        if (existing) {
            run(`UPDATE candidate_profiles SET
          first_name = ?, last_name = ?, city = ?, country = ?,
          address = ?, zip_code = ?, phone_number = ?,
          industry = ?, experience_years = ?, availability = ?,
          birth_year = ?, about = ?, profile_image_url = ?,
          status = ?, is_published = ?, updated_at = datetime('now')
        WHERE user_id = ?`,
                [
                    data.firstName || '', data.lastName || '', data.city || '', data.country || '',
                    data.address || null, data.zipCode || null, data.phoneNumber || null,
                    data.industry || '', data.experienceYears || 0, data.availability || '',
                    data.birthYear || null, data.about || null, data.profileImageUrl || null,
                    data.status || 'in Prüfung', data.isPublished ? 1 : 0, userId
                ]);
        } else {
            run(`INSERT INTO candidate_profiles (
          user_id, first_name, last_name, city, country, address, zip_code, phone_number,
          industry, experience_years, availability, birth_year, about,
          profile_image_url, avatar_seed, status, is_published
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    userId, data.firstName || '', data.lastName || '', data.city || '', data.country || '',
                    data.address || null, data.zipCode || null, data.phoneNumber || null,
                    data.industry || '', data.experienceYears || 0, data.availability || '',
                    data.birthYear || null, data.about || null, data.profileImageUrl || null,
                    userId.substring(0, 8), data.status || 'in Prüfung', data.isPublished ? 1 : 0
                ]);
        }

        // Update skills
        run('DELETE FROM candidate_skills WHERE user_id = ?', [userId]);
        for (const skill of (data.skills || [])) {
            run('INSERT OR IGNORE INTO candidate_skills (user_id, skill) VALUES (?, ?)', [userId, skill]);
        }

        // Update keywords
        run('DELETE FROM candidate_keywords WHERE user_id = ?', [userId]);
        for (const keyword of (data.boostedKeywords || [])) {
            run('INSERT OR IGNORE INTO candidate_keywords (user_id, keyword) VALUES (?, ?)', [userId, keyword]);
        }

        // Update social links
        run('DELETE FROM candidate_social_links WHERE user_id = ?', [userId]);
        for (const link of (data.socialLinks || [])) {
            run('INSERT INTO candidate_social_links (user_id, label, url) VALUES (?, ?, ?)', [userId, link.label, link.url]);
        }

        const updated = queryOne('SELECT * FROM candidate_profiles WHERE user_id = ?', [userId]);
        res.json(enrichCandidate(updated));

    } catch (error) {
        console.error('Update candidate error:', error);
        res.status(500).json({ error: 'Fehler beim Speichern des Profils' });
    }
});

// Admin action
app.post('/api/candidates/:userId/admin', (req, res) => {
    try {
        const { userId } = req.params;
        const { action, newStatus, performerId } = req.body;

        if (action === 'delete') {
            run('DELETE FROM candidate_skills WHERE user_id = ?', [userId]);
            run('DELETE FROM candidate_keywords WHERE user_id = ?', [userId]);
            run('DELETE FROM candidate_social_links WHERE user_id = ?', [userId]);
            run('DELETE FROM candidate_documents WHERE user_id = ?', [userId]);
            run('DELETE FROM candidate_profiles WHERE user_id = ?', [userId]);
            run('DELETE FROM users WHERE id = ?', [userId]);

            run('INSERT INTO audit_log (id, action, performer_id, target_id) VALUES (?, ?, ?, ?)',
                [uuid(), 'Kandidat gelöscht', performerId || 'unknown', userId]);

            res.json({ success: true });
        } else if (action === 'status' && newStatus) {
            run('UPDATE candidate_profiles SET status = ?, updated_at = datetime("now") WHERE user_id = ?',
                [newStatus, userId]);

            run('INSERT INTO audit_log (id, action, performer_id, target_id) VALUES (?, ?, ?, ?)',
                [uuid(), `Status geändert zu "${newStatus}"`, performerId || 'unknown', userId]);

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

app.get('/api/documents/:userId', (req, res) => {
    try {
        const docs = query('SELECT * FROM candidate_documents WHERE user_id = ?', [req.params.userId]);

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

app.put('/api/documents/:userId', (req, res) => {
    try {
        const { userId } = req.params;
        const { cvPdf, certificates, qualifications } = req.body;

        run('DELETE FROM candidate_documents WHERE user_id = ?', [userId]);

        if (cvPdf) {
            run('INSERT INTO candidate_documents (user_id, doc_type, file_name, file_data) VALUES (?, ?, ?, ?)',
                [userId, 'cv', cvPdf.name, cvPdf.data]);
        }

        for (const cert of (certificates || [])) {
            run('INSERT INTO candidate_documents (user_id, doc_type, file_name, file_data) VALUES (?, ?, ?, ?)',
                [userId, 'certificate', cert.name, cert.data]);
        }

        for (const qual of (qualifications || [])) {
            run('INSERT INTO candidate_documents (user_id, doc_type, file_name, file_data) VALUES (?, ?, ?, ?)',
                [userId, 'qualification', qual.name, qual.data]);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Save documents error:', error);
        res.status(500).json({ error: 'Fehler beim Speichern der Dokumente' });
    }
});

// =====================================================
// AUDIT LOG
// =====================================================

app.get('/api/audit-log', (req, res) => {
    try {
        const logs = query('SELECT * FROM audit_log ORDER BY timestamp DESC LIMIT 100');
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
