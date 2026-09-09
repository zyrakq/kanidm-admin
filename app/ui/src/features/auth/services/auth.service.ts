import type { AuthState, User } from '../types/auth.types';

// Authentication service.
//
// STUBBED: TrailBase (the previous auth backend) has been removed. Until a
// follow-up design wires real Kanidm OIDC authentication, this service never
// makes network calls and always reports an unauthenticated state.
class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
  };
  private initPromise: Promise<void> | null = null;

  private constructor() {
    // Don't initialize immediately, let components call init()
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize auth state.
   *
   * STUBBED: resolves immediately with no network call. Auth state is
   * always unauthenticated until real Kanidm OIDC integration lands.
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = Promise.resolve();
    return this.initPromise;
  }

  /**
   * Get current authentication state.
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if user is authenticated. Always `false` while auth is stubbed.
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Get current user. Always `null` while auth is stubbed.
   */
  getUser(): User | null {
    return this.authState.user ? { ...this.authState.user } : null;
  }

  /**
   * Sign in.
   *
   * STUBBED: no backend exists to authenticate against. Kept as a no-op so
   * callers don't need special-casing; the UI action that would call this
   * (`<auth-status>`'s Sign In button) is disabled until real auth lands.
   */
  async signIn(): Promise<void> {
    window.dispatchEvent(
      new CustomEvent('notification-add', {
        detail: {
          id: `auth-unavailable-${Date.now()}`,
          message: 'Sign in is not available yet.',
          type: 'info' as const,
        },
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Sign out. STUBBED: no session exists to end, resets local state only.
   */
  async signOut(): Promise<void> {
    this.authState = {
      isAuthenticated: false,
      user: null,
      token: null,
    };
  }

  /**
   * Refresh auth state. STUBBED: no-op, no network call.
   */
  async refresh(): Promise<void> {
    // No backend to refresh from while auth is stubbed.
  }
}

export const authService = AuthService.getInstance();
