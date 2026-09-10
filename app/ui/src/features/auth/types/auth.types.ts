// Authentication types shared across the auth feature.
//
// Timing values are epoch milliseconds (the backend sends epoch seconds;
// the service converts on receipt so UI code never mixes units).

export interface User {
  id: string;
  username: string;
  email?: string;
  displayName?: string;
}

/** One group from /api/auth/profile (name null when unresolvable). */
export interface GroupInfo {
  uuid: string;
  name: string | null;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  /** Epoch ms when the Kanidm session expires; null when the token has no expiry */
  sessionExpiresAt: number | null;
  /** Epoch ms until which write operations are allowed; null when no write window */
  writeUntil: number | null;
  /** Resolved Kanidm groups (empty until the profile fetch completes). */
  groups: GroupInfo[];
}
