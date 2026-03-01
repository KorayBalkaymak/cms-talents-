// Vercel Serverless Function – leitet alle /api/* Requests an Express weiter
import app from '../backend/server.js';

export const config = { runtime: 'nodejs' };

export default app;
