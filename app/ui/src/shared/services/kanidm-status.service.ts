// app/ui/src/shared/services/kanidm-status.service.ts
//
// Singleton service for the Kanidm server status shown in the footer.
// The backend is the only party that talks to Kanidm (proxy
// architecture), so this only reads GET /api/status and normalizes any
// failure into an `unreachable` status — the footer must render a state
// even when the backend itself is down.

import { apiFetch } from './http-client';

export type KanidmStatusState = 'alive' | 'unreachable' | 'version_conflict';

export interface KanidmStatus {
  state: KanidmStatusState;
  serverVersion: string | null;
  clientVersion: string | null;
}

interface StatusResponse {
  state: KanidmStatusState;
  serverVersion: string | null;
  clientVersion: string;
}

const UNREACHABLE: KanidmStatus = {
  state: 'unreachable',
  serverVersion: null,
  clientVersion: null,
};

class KanidmStatusService {
  private static instance: KanidmStatusService;

  private lastKnown: KanidmStatus | null = null;

  private constructor() {}

  static getInstance(): KanidmStatusService {
    if (!KanidmStatusService.instance) {
      KanidmStatusService.instance = new KanidmStatusService();
    }
    return KanidmStatusService.instance;
  }

  /**
   * Last fetched status (or the unreachable fallback). Lets a
   * re-mounted footer paint instantly before the first fresh response
   * arrives (SPA navigation).
   */
  getLastKnownStatus(): KanidmStatus | null {
    return this.lastKnown ? { ...this.lastKnown } : null;
  }

  /**
   * Fetch /api/status. Any failure — backend down, network error,
   * non-JSON body — maps to `unreachable` instead of throwing: the
   * footer always needs a renderable state.
   */
  async fetchStatus(): Promise<KanidmStatus> {
    let status: KanidmStatus;
    try {
      const response = await apiFetch<StatusResponse>('/api/status');
      status = {
        state: response.state,
        serverVersion: response.serverVersion ?? null,
        clientVersion: response.clientVersion ?? null,
      };
    } catch {
      status = { ...UNREACHABLE };
    }
    this.lastKnown = { ...status };
    return status;
  }
}

export const kanidmStatusService = KanidmStatusService.getInstance();
