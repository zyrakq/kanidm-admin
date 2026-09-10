// Recycle bin service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/lib.rs ~2099-2109: recycle_bin_list, recycle_bin_get,
// recycle_bin_revive); writes are wrapped in withStepUp by the calling
// component (D8).

import { apiFetch } from '@/shared/services/http-client';
import type { KanidmEntry } from '@/shared/types/kanidm';
import type { RecycleBinEntry } from '../types/recycle-bin.types';
import { toRecycleBinEntry } from '../types/recycle-bin.types';

const BASE = '/api/kanidm/v1';

class RecycleBinService {
  private static instance: RecycleBinService;

  private constructor() {}

  static getInstance(): RecycleBinService {
    if (!RecycleBinService.instance) {
      RecycleBinService.instance = new RecycleBinService();
    }
    return RecycleBinService.instance;
  }

  /** List recycle bin entries (GET /v1/recycle_bin, vendor recycle_bin_list). */
  async list(): Promise<RecycleBinEntry[]> {
    const entries = await apiFetch<KanidmEntry[]>(`${BASE}/recycle_bin`);
    return entries.map(toRecycleBinEntry);
  }

  /** Get one raw recycle bin entry (vendor recycle_bin_get; None -> null). */
  async get(id: string): Promise<KanidmEntry | null> {
    return apiFetch<KanidmEntry | null>(
      `${BASE}/recycle_bin/${encodeURIComponent(id)}`
    );
  }

  /**
   * Revive (vendor recycle_bin_revive: POST /v1/recycle_bin/{id}/_revive
   * with the unit body (), which serde serializes as JSON null).
   */
  async revive(id: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/recycle_bin/${encodeURIComponent(id)}/_revive`,
      { method: 'POST', body: 'null' }
    );
  }
}

export const recycleBinService = RecycleBinService.getInstance();
