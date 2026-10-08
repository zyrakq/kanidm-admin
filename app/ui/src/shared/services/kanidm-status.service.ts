// app/ui/src/shared/services/kanidm-status.service.ts
//
// Singleton service for the Kanidm server status shown in the footer
// and the version banner. The backend is the only party that talks to
// Kanidm (proxy architecture), so this only reads GET /api/status and
// normalizes any failure into an `unreachable` status — consumers must
// always get a renderable state, even when the backend itself is down.
// After every fetch it dispatches `kanidm-status-changed` on window so
// additional status consumers stay in sync without their own polling.

import { apiFetch } from './http-client';

export type KanidmStatusState =
  | 'alive'
  | 'unreachable'
  | 'version_warning'
  | 'version_conflict';

export interface KanidmStatus {
  state: KanidmStatusState;
  serverVersion: string | null;
  clientVersion: string | null;
  /** Advertised compatibility range, e.g. "1.10 – 1.12" (backend-computed). */
  supportedRange: string | null;
  /** Effective Kanidm base URL (resolved backend-side, container mode aware). */
  kanidmUrl: string | null;
}

interface StatusResponse {
  state: KanidmStatusState;
  serverVersion: string | null;
  clientVersion: string;
  supportedRange?: string | null;
  kanidmUrl: string;
}

const UNREACHABLE: KanidmStatus = {
  state: 'unreachable',
  serverVersion: null,
  clientVersion: null,
  supportedRange: null,
  kanidmUrl: null,
};

export class KanidmStatusService {
  private static instance: KanidmStatusService;

  /** Window event name fired after every successful fetch of the status. */
  static readonly STATUS_EVENT = 'kanidm-status-changed';

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
        supportedRange: response.supportedRange ?? null,
        kanidmUrl: response.kanidmUrl ?? null,
      };
    } catch {
      status = { ...UNREACHABLE };
    }
    this.lastKnown = { ...status };
    // Push to every subscriber (version banner) instead of each
    // component polling /api/status on its own.
    window.dispatchEvent(
      new CustomEvent(KanidmStatusService.STATUS_EVENT, { detail: status })
    );
    return status;
  }
}

export const kanidmStatusService = KanidmStatusService.getInstance();
