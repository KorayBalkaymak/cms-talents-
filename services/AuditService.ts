import { AuditLog } from '../types';
import { api } from './ApiClient';

// =====================================================
// AUDIT SERVICE - Using Backend API
// =====================================================

class AuditService {
    async getAll(): Promise<AuditLog[]> {
        try {
            return await api.getAuditLog();
        } catch (e) {
            console.error('[AuditService] Error fetching audit log:', e);
            return [];
        }
    }

    // Note: Logging is now done server-side in admin actions
    logAction(performerId: string, targetId: string, action: string): void {
        // No-op - logging is done by the backend
        console.log(`[Audit] ${action} by ${performerId} on ${targetId}`);
    }
}

export const auditService = new AuditService();
