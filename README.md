# CMS Talents - Recruiting Marketplace

A full-stack candidate management system connecting top talents with exclusive employers.

## 🚀 Features

- **Candidate Portal**: Profile creation, CV/Certificate uploads (PDF), real-time status updates.
- **Recruiter Dashboard**: Admin view, candidate status management, document previews.
- **Talent Marketplace**: Advanced search, filtering, and "Speed Match" layout.
- **Privacy First**: Granular visibility controls (Public vs Admin Only data).
- **Tech Stack**: React, Vite, TypeScript, Tailwind CSS, Node.js, Express, SQLite.

## 🛠️ Local Development

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd cms-talents
   ```

2. **Backend Setup**
   ```bash
   cd backend
   npm install
   npm start
   ```
   The backend runs on port 3001.

3. **Frontend Setup**
   Open a new terminal:
   ```bash
   npm install
   npm run dev
   ```
   The frontend runs on port 3000.

## 📦 Deployment (Vercel)

This project is configured for Vercel deployment with some considerations:

1. **Frontend**: Deployed as a standard Vite app.
2. **Backend**: Deployed as Serverless Functions via `vercel.json` rewrites.
3. **Database**: 
   > **⚠️ IMPORTANT**: This project uses a local SQLite file (`cms_talents.db`). 
   > On Vercel, the file system is **ephemeral**. This means any data you register or save will be **LOST** when the serverless function restarts (typically immediately or after a short idle time).
   > **For a persistent production deployment**, you must switch the database adapter to a cloud provider like Turso, Supabase, or use a VPS instead of Vercel Serverless.

### How to Deploy

1. Push this code to GitHub.
2. Import the project in Vercel.
3. Vercel should auto-detect the settings.
   - **Framework Preset**: Vite
   - **Root Directory**: `./`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
4. Add Environment Variables if necessary.
5. Deploy!

## 🔒 Credentials

**Demo Admin Login**:
- Email: `admin@cms.com`
- Password: `password`
*(Note: These are created on first backend start if database is empty)*

---
© 2024 CMS Talents
