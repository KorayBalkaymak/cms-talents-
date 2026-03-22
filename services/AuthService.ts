import { api } from './ApiClient';
import { User, UserRole } from '../types';
import { supabase } from '../utils/supabase';

const SESSION_KEY = 'cms_talents_session';

class AuthService {
  private currentUser: User | null = null;

  constructor() {
    this.loadSession();
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
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        this.currentUser = null;
        localStorage.removeItem(SESSION_KEY);
        return;
      }

      const user = await api.getSessionUser();
      if (user) {
        this.saveSession(user);
      } else {
        this.currentUser = null;
        localStorage.removeItem(SESSION_KEY);
        await supabase.auth.signOut();
      }
    } catch (e) {
      console.error('[Auth] ensureInit failed:', e);
    }
  }

  getCurrentUser(): User | null {
    return this.currentUser;
  }

  async register(
    email: string,
    password: string,
    role: UserRole
  ): Promise<{ success: boolean; user?: User; message?: string; needsVerification?: boolean; error?: string }> {
    try {
      const result = await api.register(email, password, role);

      if (result.success && result.user) {
        const user: User = {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role as UserRole,
          createdAt: result.user.createdAt ?? new Date().toISOString(),
          firstName: result.user.firstName,
        };
        this.saveSession(user);
        return { success: true, user };
      }

      if (result.success && result.needsVerification) {
        return {
          success: true,
          message:
            result.message ||
            'Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den Supabase an Sie sendet.',
          needsVerification: true,
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
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const result = await api.login(email, password, expectedRole);

      if (result.success && result.user) {
        const user: User = {
          id: result.user.id,
          email: result.user.email,
          role: result.user.role as UserRole,
          createdAt: result.user.createdAt ?? new Date().toISOString(),
          firstName: result.user.firstName,
        };
        this.saveSession(user);
        return { success: true, user };
      }

      return { success: false, error: result.error || 'Anmeldung fehlgeschlagen' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Anmeldung fehlgeschlagen' };
    }
  }

  async refreshCurrentUser(): Promise<User | null> {
    await this.ensureInit();
    return this.currentUser;
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
    void supabase.auth.signOut();
  }

  async deleteMyAccount(): Promise<{ success: boolean; error?: string }> {
    const me = this.getCurrentUser();
    if (!me?.id) return { success: false, error: 'Nicht eingeloggt.' };

    try {
      const res = await api.deleteAccount();
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
