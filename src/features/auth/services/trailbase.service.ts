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
    try {
      let url = `/api/auth/v1/oauth/${provider}/login`;

      if (redirectUri) {
        url += `?redirect_uri=${encodeURIComponent(redirectUri)}`;
      }

      window.location.href = url;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get current login status
   * @returns Login status with tokens or null if not authenticated
   */
  async getLoginStatus(): Promise<LoginStatusResponse | null> {
    try {
      const response = await fetch('/api/auth/v1/status', {
        credentials: 'include', // Include cookies
      });

      if (response.status === 401) {
        return null;
      }

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.statusText}`);
      }

      const status: LoginStatusResponse = await response.json();

      return status;
    } catch (error) {
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
        return null;
      }

      // Decode payload (base64url)
      const payload = JSON.parse(atob(parts[1]));

      return {
        id: payload.sub || payload.user_id || payload.id,
        email: payload.email,
        verified: payload.verified,
      };
    } catch (error) {
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
        return null;
      }

      const user = this.parseUserFromToken(status.auth_token);
      return user;
    } catch (error) {
      return null;
    }
  }

  /**
   * Logout current user
   * @param redirectUri - Optional redirect URI after logout
   */
  async logout(redirectUri?: string): Promise<void> {
    try {
      let url = '/api/auth/v1/logout';
      if (redirectUri) {
        url += `?redirect_uri=${encodeURIComponent(redirectUri)}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`Logout failed: ${response.statusText}`);
      }
    } catch (error) {
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
      return false;
    }
  }
}

export const trailbaseService = TrailBaseService.getInstance();
