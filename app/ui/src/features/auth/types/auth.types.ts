// Authentication types and interfaces

export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
}

export interface OIDCConfig {
  clientId: string;
  redirectUri: string;
  authorizationEndpoint: string;
  tokenEndpoint: string;
  scope: string;
}
