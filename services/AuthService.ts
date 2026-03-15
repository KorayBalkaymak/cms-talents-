import { User, UserRole } from '../types';
import { api } from './ApiClient';

// =====================================================
// AUTH SERVICE - Using Backend API
// =====================================================

const SESSION_KEY = 'cms_talents_session';

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    this.loadSession();
  }

  private isLocalhost(): boolean {
    try {
      const h = window.location.hostname;
      return h === 'localhost' || h === '127.0.0.1';
    } catch {
      return false;
    }
  }

  private loadSession(): void {
    try {
      const stored = localStorage.getItem(SESSION_KEY);
      if (stored) {
        this.currentUser = JSON.parse(stored);
      }
    } catch (e) {
      console.error('[Auth] Error loading session:', e);
    }
  }

  private saveSession(user: User): void {
    this.currentUser = user;
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  }

  async ensureInit(): Promise<void> {
    // No longer need to create demo accounts - backend does this
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async register(
    email: string,
    password: string,
    role: UserRole
  ): Promise<{ success: boolean; user?: User; message?: string; verificationToken?: string; error?: string }> {
    try {
      const result = await api.register(email, password, role);

      if (result.success && result.user) {
        const user: User = {
          id: result.user.id,
          email: result.user.email,
          passwordHash: '',
          role: result.user.role as UserRole,
          createdAt: result.user.createdAt ?? result.user.created_at ?? new Date().toISOString()
        };
        this.saveSession(user);
        return { success: true, user };
      }

      if (result.success && result.verificationToken) {
        // Lokal (ohne E-Mail-Versand): automatisch verifizieren + einloggen,
        // damit der Nutzer nicht "festhängt".
        if (this.isLocalhost()) {
          try {
            await api.verifyEmail(result.verificationToken);
            const loginRes = await api.login(email, password, role);
            if (loginRes?.success && loginRes.user) {
              const user: User = {
                id: loginRes.user.id,
                email: loginRes.user.email,
                passwordHash: '',
                role: loginRes.user.role as UserRole,
                createdAt: loginRes.user.createdAt ?? loginRes.user.created_at ?? new Date().toISOString()
              };
              this.saveSession(user);
              return { success: true, user };
            }
          } catch {
            // fallback to manual verification UI
          }
        }
        return {
          success: true,
          message: result.message || 'Bitte bestätigen Sie Ihre E-Mail-Adresse.',
          verificationToken: result.verificationToken
        };
      }

      return { success: false, error: result.error || 'Registrierung fehlgeschlagen' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Registrierung fehlgeschlagen' };
    }
  }

  async login(
    email: string,
    password: string,
    expectedRole?: UserRole
  ): Promise<{ success: boolean; user?: User; error?: string; needsVerification?: boolean; verificationToken?: string }> {
    try {
      const result = await api.login(email, password, expectedRole);

      if (result.success && result.user) {
        const user: User = {
          id: result.user.id,
          email: result.user.email,
          passwordHash: '',
          role: result.user.role as UserRole,
          createdAt: result.user.createdAt ?? result.user.created_at ?? new Date().toISOString()
        };
        this.saveSession(user);
        return { success: true, user };
      }

      return { success: false, error: result.error || 'Anmeldung fehlgeschlagen' };
    } catch (e: any) {
      const needsVerification = !!e?.data?.needsVerification;
      const verificationToken = e?.data?.verificationToken;
      if (needsVerification) {
        // Lokal: automatisch verifizieren und einmal erneut versuchen
        if (this.isLocalhost() && verificationToken) {
          try {
            await api.verifyEmail(verificationToken);
            const retry = await api.login(email, password, expectedRole);
            if (retry?.success && retry.user) {
              const user: User = {
                id: retry.user.id,
                email: retry.user.email,
                passwordHash: '',
                role: retry.user.role as UserRole,
                createdAt: retry.user.createdAt ?? retry.user.created_at ?? new Date().toISOString()
              };
              this.saveSession(user);
              return { success: true, user };
            }
          } catch {
            // fallback to showing verification UI
          }
        }
        return {
          success: false,
          error: e?.message || 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse.',
          needsVerification: true,
          verificationToken
        };
      }
      return { success: false, error: e.message || 'Anmeldung fehlgeschlagen' };
    }
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  }

  async deleteMyAccount(password: string): Promise<{ success: boolean; error?: string }> {
    const me = this.getCurrentUser();
    if (!me?.email) return { success: false, error: 'Nicht eingeloggt.' };
    try {
      const res = await api.deleteAccount(me.email, password);
      if (res?.success) {
        this.logout();
        return { success: true };
      }
      return { success: false, error: res?.error || 'Konto konnte nicht gelöscht werden.' };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Konto konnte nicht gelöscht werden.' };
    }
  }
}

export const authService = new AuthService();
