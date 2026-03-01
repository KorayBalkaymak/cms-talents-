// Vercel Serverless Function (Catch-All) – handled /api/* routes
import app from '../backend/server.js';

export const config = { runtime: 'nodejs' };

export default app;

