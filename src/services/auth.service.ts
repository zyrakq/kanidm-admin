import type { AuthState, User } from '@/types/auth.types';
import {
  trailbaseService,
  type TrailBaseUser,
} from '@/services/trailbase.service';
import { notificationService } from '@/services/notification.service';

// Authentication service using TrailBase
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
   * Initialize auth state by checking with TrailBase
   * Should be called when app starts
   */
  async init(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this.loadAuthState();
    return this.initPromise;
  }

  /**
   * Load authentication state from TrailBase
   */
  private async loadAuthState(): Promise<void> {
    try {
      const trailbaseUser = await trailbaseService.getCurrentUser();

      if (trailbaseUser) {
        this.authState = {
          isAuthenticated: true,
          user: this.mapTrailBaseUser(trailbaseUser),
          token: null, // TrailBase uses cookies, no token needed
        };
      } else {
        this.authState = {
          isAuthenticated: false,
          user: null,
          token: null,
        };
      }
    } catch (error) {
      notificationService.warning(
        'Failed to load authentication state. Please refresh the page.'
      );
      this.authState = {
        isAuthenticated: false,
        user: null,
        token: null,
      };
    }
  }

  /**
   * Map TrailBase user to our User type
   */
  private mapTrailBaseUser(tbUser: TrailBaseUser): User {
    return {
      id: tbUser.id,
      username: tbUser.email || tbUser.id,
      email: tbUser.email,
      displayName: tbUser.email,
    };
  }

  /**
   * Get current authentication state
   */
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  /**
   * Get current user
   */
  getUser(): User | null {
    return this.authState.user ? { ...this.authState.user } : null;
  }

  /**
   * Initiate sign in via TrailBase OAuth
   * @param provider - OAuth provider name
   * @param redirectUri - Where to redirect after successful login
   */
  async signIn(
    provider: string = 'oidc0',
    redirectUri?: string
  ): Promise<void> {
    await trailbaseService.login(provider, redirectUri);
  }

  /**
   * Sign out current user
   */
  async signOut(): Promise<void> {
    try {
      await trailbaseService.logout();
      this.authState = {
        isAuthenticated: false,
        user: null,
        token: null,
      };
    } catch (error) {
      notificationService.error('Failed to sign out. Please try again.');
      throw error;
    }
  }

  /**
   * Refresh auth state from TrailBase
   * Useful after OAuth callback
   */
  async refresh(): Promise<void> {
    await this.loadAuthState();
  }
}

export const authService = AuthService.getInstance();
