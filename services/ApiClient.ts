// =====================================================
// API CLIENT - Connects frontend to backend
// =====================================================

// @ts-ignore
const API_BASE = import.meta.env.PROD ? '/api' : 'http://localhost:3001/api';

class ApiClient {
    private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
        const url = `${API_BASE}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'API request failed');
        }

        return data;
    }

    // =====================================================
    // AUTH
    // =====================================================

    async register(email: string, password: string, role: string) {
        return this.request<{ success: boolean; user: any; error?: string }>('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, role }),
        });
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
