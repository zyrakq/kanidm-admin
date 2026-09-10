import { msg } from '@lit/localize';
import { apiFetch, ApiError } from '@/shared/services/http-client';
import { notificationService } from '@/features/notifications';
import type { AuthState, GroupInfo, User } from '../types/auth.types';

// Backend response shapes (epoch SECONDS — converted to ms on receipt).

interface SessionUserResponse {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
}

interface SessionResponse {
  user: SessionUserResponse;
  sessionExpiresAt: number | null;
  writeUntil: number | null;
}

interface ReauthResponse {
  writeUntil: number | null;
}

interface ProfileGroupResponse {
  uuid: string;
  name: string | null;
}

interface ProfileResponse {
  user: SessionUserResponse;
  groups: ProfileGroupResponse[];
}

/** Maximum password attempts offered in one step-up flow. */
const MAX_STEP_UP_ATTEMPTS = 3;

class AuthService {
  private static instance: AuthService;

  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    sessionExpiresAt: null,
    writeUntil: null,
    groups: [],
  };

  private initPromise: Promise<void> | null = null;
  private stepUpResolve: ((password: string | null) => void) | null = null;

  private constructor() {
    // The shared http client signals session expiry from any API call.
    window.addEventListener('auth-session-expired', () => {
      void this.handleSessionExpired();
    });
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  /**
   * Initialize auth state. Safe to call from multiple components; the
   * underlying session request runs once. A 401 here simply means "not
   * authenticated" (no cookie) and is not an error.
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }
    this.initPromise = this.restoreSession();
    return this.initPromise;
  }

  /** Re-fetch the session state from the backend. */
  async refresh(): Promise<void> {
    await this.restoreSession();
  }

  private async restoreSession(): Promise<void> {
    try {
      const session = await apiFetch<SessionResponse>('/api/auth/session', {
        ignoreSessionExpired: true,
      });
      this.applySession(session);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.resetState();
        return;
      }
      throw error;
    }
    await this.fetchProfile();
  }

  private async fetchProfile(): Promise<void> {
    try {
      const profile = await apiFetch<ProfileResponse>('/api/auth/profile', {
        ignoreSessionExpired: true,
      });
      this.authState = {
        ...this.authState,
        groups: profile.groups.map((group) => ({
          uuid: group.uuid,
          name: group.name,
        })),
      };
      this.notifyStateChanged();
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        this.resetState();
        this.notifyStateChanged();
      }
      // Other failures: keep the session, leave groups empty.
    }
  }

  /** Broadcast every auth state mutation to interested components (D7). */
  private notifyStateChanged(): void {
    window.dispatchEvent(new CustomEvent('auth-state-changed'));
  }

  private applySession(session: SessionResponse): void {
    this.authState = {
      isAuthenticated: true,
      user: {
        id: session.user.id,
        username: session.user.username,
        displayName: session.user.displayName,
        email: session.user.email ?? undefined,
      },
      sessionExpiresAt:
        session.sessionExpiresAt !== null
          ? session.sessionExpiresAt * 1000
          : null,
      writeUntil:
        session.writeUntil !== null ? session.writeUntil * 1000 : null,
      groups: this.authState.groups,
    };
    this.notifyStateChanged();
  }

  private resetState(): void {
    this.authState = {
      isAuthenticated: false,
      user: null,
      sessionExpiresAt: null,
      writeUntil: null,
      groups: [],
    };
    this.notifyStateChanged();
  }

  getAuthState(): AuthState {
    return { ...this.authState };
  }

  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  getUser(): User | null {
    return this.authState.user ? { ...this.authState.user } : null;
  }

  /** Resolved group names (null names dropped). */
  getGroups(): string[] {
    return this.authState.groups
      .map((group) => group.name)
      .filter((name): name is string => name !== null);
  }

  /** Raw profile groups (uuid + name|null). */
  getGroupInfo(): GroupInfo[] {
    return [...this.authState.groups];
  }

  hasGroup(name: string): boolean {
    return this.getGroups().includes(name);
  }

  /** Sign in with username + password; throws ApiError on failure. */
  async signIn(username: string, password: string): Promise<void> {
    const session = await apiFetch<SessionResponse>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
    this.applySession(session);
    // Fetch groups before resolving so the first navigation already
    // knows the visible sections.
    await this.fetchProfile();
  }

  /** Sign out: revoke server-side, then reset local state either way. */
  async signOut(): Promise<void> {
    try {
      await apiFetch<void>('/api/auth/logout', { method: 'POST' });
    } finally {
      this.resetState();
    }
  }

  /** Step-up reauth; refreshes the write window from the response. */
  async reauth(password: string): Promise<void> {
    const result = await apiFetch<ReauthResponse>('/api/auth/reauth', {
      method: 'POST',
      body: JSON.stringify({ password }),
    });
    this.authState = {
      ...this.authState,
      writeUntil:
        result.writeUntil !== null ? result.writeUntil * 1000 : null,
    };
  }

  /**
   * Run a write operation with automatic step-up: on `reauth_required`
   * the global password modal opens (via 'auth-step-up-open'), the reauth
   * endpoint is called, and the original operation is retried.
   */
  async withStepUp<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (!(error instanceof ApiError) || error.code !== 'reauth_required') {
        throw error;
      }
      return this.runStepUp(operation, error);
    }
  }

  private async runStepUp<T>(
    operation: () => Promise<T>,
    originalError: ApiError
  ): Promise<T> {
    let attemptError: string | null = null;

    for (let attempt = 0; attempt < MAX_STEP_UP_ATTEMPTS; attempt++) {
      const password = await this.promptForStepUp(attemptError);
      if (password === null) {
        // User cancelled: surface the original reauth_required error.
        throw originalError;
      }
      try {
        await this.reauth(password);
        notificationService.success(msg('Elevated access granted.'));
        return await operation();
      } catch (error) {
        if (error instanceof ApiError && error.code === 'invalid_credentials') {
          attemptError = error.message;
          continue;
        }
        throw error;
      }
    }

    throw originalError;
  }

  private promptForStepUp(attemptError: string | null): Promise<string | null> {
    return new Promise((resolve) => {
      this.stepUpResolve = resolve;
      window.dispatchEvent(
        new CustomEvent('auth-step-up-open', {
          detail: { error: attemptError },
          bubbles: true,
          composed: true,
        })
      );
    });
  }

  /** Called by the reauth modal when the user submits a password. */
  submitStepUp(password: string): void {
    this.stepUpResolve?.(password);
    this.stepUpResolve = null;
  }

  /** Called by the reauth modal when the user cancels. */
  cancelStepUp(): void {
    this.stepUpResolve?.(null);
    this.stepUpResolve = null;
  }

  /**
   * Local expiry handling (countdown hit zero or any API call returned
   * session_expired): reset state, notify, return to the welcome page.
   */
  async handleSessionExpired(): Promise<void> {
    if (!this.authState.isAuthenticated) {
      return;
    }
    this.resetState();
    notificationService.warning(
      msg('Your session has expired. Please sign in again.')
    );
    window.location.assign('/');
  }
}

export const authService = AuthService.getInstance();
