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
  ): Promise<{ success: boolean; user?: User; error?: string }> {
    try {
      const result = await api.register(email, password, role);

      if (result.success && result.user) {
        const user: User = {
          id: result.user.id,
          email: result.user.email,
          passwordHash: '', // Not stored client-side
          role: result.user.role as UserRole,
          createdAt: result.user.createdAt
        };
        this.saveSession(user);
        return { success: true, user };
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
          passwordHash: '',
          role: result.user.role as UserRole,
          createdAt: result.user.createdAt
        };
        this.saveSession(user);
        return { success: true, user };
      }

      return { success: false, error: result.error || 'Anmeldung fehlgeschlagen' };
    } catch (e: any) {
      return { success: false, error: e.message || 'Anmeldung fehlgeschlagen' };
    }
  }

  logout(): void {
    this.currentUser = null;
    localStorage.removeItem(SESSION_KEY);
  }
}

export const authService = new AuthService();
