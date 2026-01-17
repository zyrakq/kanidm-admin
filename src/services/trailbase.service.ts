// TrailBase API client
// Documentation: https://trailbase.io/documentation/auth
// OpenAPI: https://trailbase.io/api

/**
 * Response from /api/auth/v1/status endpoint
 */
export interface LoginStatusResponse {
  auth_token: string | null;
  csrf_token: string | null;
  refresh_token: string | null;
}

/**
 * User information extracted from JWT token or API
 */
export interface TrailBaseUser {
  id: string;
  email?: string;
  verified?: boolean;
}

class TrailBaseService {
  private static instance: TrailBaseService;

  private constructor() {
    // TrailBase runs on the same origin, so we use relative URLs
  }

  static getInstance(): TrailBaseService {
    if (!TrailBaseService.instance) {
      TrailBaseService.instance = new TrailBaseService();
    }
    return TrailBaseService.instance;
  }

  /**
   * Redirect to OAuth login
   * @param provider - OAuth provider key (e.g., 'oidc0')
   * @param redirectUri - Optional redirect URI after successful login
   */
  async login(provider: string = 'oidc0', redirectUri?: string): Promise<void> {
    console.log(
      `[TrailBase] Initiating OAuth login with provider: ${provider}`
    );
    try {
      let url = `/api/auth/v1/oauth/${provider}/login`;

      if (redirectUri) {
        url += `?redirect_uri=${encodeURIComponent(redirectUri)}`;
      }

      console.log(`[TrailBase] Redirecting to: ${url}`);
      window.location.href = url;
    } catch (error) {
      console.error('[TrailBase] Login error:', error);
      throw error;
    }
  }

  /**
   * Get current login status
   * @returns Login status with tokens or null if not authenticated
   */
  async getLoginStatus(): Promise<LoginStatusResponse | null> {
    try {
      console.log('[TrailBase] Checking login status...');
      const response = await fetch('/api/auth/v1/status', {
        credentials: 'include', // Include cookies
      });

      if (response.status === 401) {
        console.log('[TrailBase] User not authenticated (401)');
        return null;
      }

      if (!response.ok) {
        console.error('[TrailBase] Failed to get status:', response.status);
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const status: LoginStatusResponse = await response.json();
      console.log('[TrailBase] Login status:', {
        hasAuthToken: !!status.auth_token,
        hasCsrfToken: !!status.csrf_token,
        hasRefreshToken: !!status.refresh_token,
      });

      return status;
    } catch (error) {
      console.error('[TrailBase] Error getting login status:', error);
      throw error;
    }
  }

  /**
   * Parse user info from JWT auth token
   * @param authToken - JWT token
   * @returns User info or null
   */
  private parseUserFromToken(authToken: string): TrailBaseUser | null {
    try {
      // JWT has 3 parts: header.payload.signature
      const parts = authToken.split('.');
      if (parts.length !== 3) {
        console.error('[TrailBase] Invalid JWT format');
        return null;
      }

      // Decode payload (base64url)
      const payload = JSON.parse(atob(parts[1]));
      console.log('[TrailBase] Parsed JWT payload:', payload);

      return {
        id: payload.sub || payload.user_id || payload.id,
        email: payload.email,
        verified: payload.verified,
      };
    } catch (error) {
      console.error('[TrailBase] Failed to parse JWT:', error);
      return null;
    }
  }

  /**
   * Get current authenticated user
   * @returns User info or null if not authenticated
   */
  async getCurrentUser(): Promise<TrailBaseUser | null> {
    try {
      const status = await this.getLoginStatus();

      if (!status || !status.auth_token) {
        console.log('[TrailBase] No auth token found');
        return null;
      }

      const user = this.parseUserFromToken(status.auth_token);
      console.log('[TrailBase] Current user:', user);
      return user;
    } catch (error) {
      console.error('[TrailBase] Error getting current user:', error);
      return null;
    }
  }

  /**
   * Logout current user
   * @param redirectUri - Optional redirect URI after logout
   */
  async logout(redirectUri?: string): Promise<void> {
    try {
      console.log('[TrailBase] Logging out...');

      let url = '/api/auth/v1/logout';
      if (redirectUri) {
        url += `?redirect_uri=${encodeURIComponent(redirectUri)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        console.error('[TrailBase] Logout failed:', response.status);
        throw new Error(`Logout failed: ${response.statusText}`);
      }

      console.log('[TrailBase] Logout successful');
    } catch (error) {
      console.error('[TrailBase] Logout error:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      const status = await this.getLoginStatus();
      return status !== null && status.auth_token !== null;
    } catch (error) {
      console.error('[TrailBase] Auth check error:', error);
      return false;
    }
  }
}

export const trailbaseService = TrailBaseService.getInstance();
