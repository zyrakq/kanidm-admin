import type { AuthState, User } from '../types/auth.types';

// Mock authentication service
// This will be replaced with actual OIDC integration later
class AuthService {
  private static instance: AuthService;
  private authState: AuthState = {
    isAuthenticated: false,
    user: null,
    token: null,
  };

  private constructor() {
    this.loadAuthState();
  }

  static getInstance(): AuthService {
    if (!AuthService.instance) {
      AuthService.instance = new AuthService();
    }
    return AuthService.instance;
  }

  // Load authentication state from localStorage
  private loadAuthState(): void {
    const token = localStorage.getItem('auth_token');
    const userStr = localStorage.getItem('auth_user');

    if (token && userStr) {
      try {
        const user: User = JSON.parse(userStr);
        this.authState = {
          isAuthenticated: true,
          user,
          token,
        };
      } catch (error) {
        console.error('Failed to parse user data:', error);
        this.clearAuthState();
      }
    }
  }

  // Save authentication state to localStorage
  private saveAuthState(): void {
    if (this.authState.token && this.authState.user) {
      localStorage.setItem('auth_token', this.authState.token);
      localStorage.setItem('auth_user', JSON.stringify(this.authState.user));
    }
  }

  // Clear authentication state
  private clearAuthState(): void {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    this.authState = {
      isAuthenticated: false,
      user: null,
      token: null,
    };
  }

  // Get current authentication state
  getAuthState(): AuthState {
    return { ...this.authState };
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return this.authState.isAuthenticated;
  }

  // Get current user
  getUser(): User | null {
    return this.authState.user ? { ...this.authState.user } : null;
  }

  // Mock sign in (will be replaced with OIDC flow)
  async signIn(): Promise<void> {
    // TODO: Implement actual OIDC redirect
    console.log('Sign in initiated - redirect to OIDC provider');

    // For now, just throw to indicate this needs implementation
    throw new Error('OIDC integration not implemented yet');
  }

  // Sign out
  signOut(): void {
    this.clearAuthState();
    // TODO: Implement OIDC logout if needed
  }

  // Mock method to simulate successful authentication (for testing)
  // Remove this when implementing real OIDC
  mockSignIn(user: User, token: string): void {
    this.authState = {
      isAuthenticated: true,
      user,
      token,
    };
    this.saveAuthState();
  }
}

export const authService = AuthService.getInstance();
