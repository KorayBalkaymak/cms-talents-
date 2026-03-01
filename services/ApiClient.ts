// =====================================================
// API CLIENT - Connects frontend to backend
// =====================================================
// In dev Vite proxies /api to localhost:3001 – Backend muss laufen: cd backend && npm run dev

const API_BASE = '/api';

class ApiClient {
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${API_BASE}${endpoint}`;

        let response: Response;
        try {
            const controller = new AbortController();
            const timeoutMs = 12000;
            const timeout = setTimeout(() => controller.abort(), timeoutMs);

            response = await fetch(url, {
                ...options,
                signal: controller.signal,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });
            clearTimeout(timeout);
        } catch (e) {
            const isAbort = typeof e === 'object' && e !== null && 'name' in e && (e as any).name === 'AbortError';
            throw new Error(isAbort
              ? 'Anfrage dauert zu lange (Timeout). Bitte Seite neu laden.'
              : 'Backend nicht erreichbar. Bitte im Ordner "backend" starten: npm run dev'
            );
        }

        const text = await response.text();
        let data: any;
        try {
            data = text ? JSON.parse(text) : {};
        } catch {
            throw new Error('Backend nicht erreichbar. Bitte im Ordner "backend" starten: npm run dev');
        }

        if (!response.ok) {
            const msg = data?.error || data?.message || (response.status === 404 ? 'Backend nicht erreichbar. Bitte Backend starten: im Ordner "backend" → npm run dev' : `Anfrage fehlgeschlagen (${response.status})`);
            const err: any = new Error(msg);
            err.status = response.status;
            err.data = data;
            throw err;
        }

        return data;
    }

    // =====================================================
    // AUTH
    // =====================================================

    async register(email: string, password: string, role: string) {
        return this.request<{ success: boolean; user?: any; message?: string; verificationToken?: string; error?: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, role }),
        });
    }

    async verifyEmail(token: string) {
        return this.request<{ success: boolean; message?: string; error?: string }>(`/auth/verify-email?token=${encodeURIComponent(token)}`, { method: 'GET' });
    }

    async login(email: string, password: string, expectedRole?: string) {
        return this.request<{ success: boolean; user: any; error?: string }>('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password, expectedRole }),
        });
    }

    // =====================================================
    // CANDIDATES
    // =====================================================

    async getCandidates() {
        return this.request<any[]>('/candidates');
    }

    async getAllCandidates() {
        return this.request<any[]>('/candidates/all');
    }

    async getCandidate(userId: string) {
        return this.request<any>(`/candidates/${userId}`);
    }

    async updateCandidate(userId: string, data: any) {
        return this.request<any>(`/candidates/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async adminAction(userId: string, action: string, newStatus?: string, performerId?: string) {
        return this.request<{ success: boolean }>(`/candidates/${userId}/admin`, {
            method: 'POST',
            body: JSON.stringify({ action, newStatus, performerId }),
        });
    }

    // =====================================================
    // DOCUMENTS
    // =====================================================

    async getDocuments(userId: string) {
        return this.request<any>(`/documents/${userId}`);
    }

    async updateDocuments(userId: string, data: any) {
        return this.request<{ success: boolean }>(`/documents/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    // =====================================================
    // AUDIT LOG
    // =====================================================

    async getAuditLog() {
        return this.request<any[]>('/audit-log');
    }
}

export const api = new ApiClient();
