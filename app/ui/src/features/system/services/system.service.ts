// System settings service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/system.rs); writes are wrapped in withStepUp by the
// calling components (D8).

import { apiFetch } from '@/shared/services/http-client';

const BASE = '/api/kanidm/v1/system/_attr';

class SystemService {
  private static instance: SystemService;

  private constructor() {}

  static getInstance(): SystemService {
    if (!SystemService.instance) {
      SystemService.instance = new SystemService();
    }
    return SystemService.instance;
  }

  /**
   * Password badlist (vendor system_password_badlist_get:
   * GET /v1/system/_attr/badlist_password, null -> []).
   */
  async badlistGet(): Promise<string[]> {
    const list = await apiFetch<string[] | null>(`${BASE}/badlist_password`);
    return list ?? [];
  }

  /** Append entries (vendor system_password_badlist_append: POST, body [...]). */
  async badlistAppend(list: string[]): Promise<void> {
    await apiFetch<void>(`${BASE}/badlist_password`, {
      method: 'POST',
      body: JSON.stringify(list),
    });
  }

  /**
   * Remove entries (vendor system_password_badlist_remove:
   * DELETE-with-body /v1/system/_attr/badlist_password, body [...]).
   */
  async badlistRemove(list: string[]): Promise<void> {
    await apiFetch<void>(`${BASE}/badlist_password`, {
      method: 'DELETE',
      body: JSON.stringify(list),
    });
  }

  /**
   * Denied names (vendor system_denied_names_get:
   * GET /v1/system/_attr/denied_name, null -> []).
   */
  async deniedNamesGet(): Promise<string[]> {
    const list = await apiFetch<string[] | null>(`${BASE}/denied_name`);
    return list ?? [];
  }

  /** Append entries (vendor system_denied_names_append: POST, body [...]). */
  async deniedNamesAppend(list: string[]): Promise<void> {
    await apiFetch<void>(`${BASE}/denied_name`, {
      method: 'POST',
      body: JSON.stringify(list),
    });
  }

  /**
   * Remove entries (vendor system_denied_names_remove:
   * DELETE-with-body /v1/system/_attr/denied_name, body [...]).
   */
  async deniedNamesRemove(list: string[]): Promise<void> {
    await apiFetch<void>(`${BASE}/denied_name`, {
      method: 'DELETE',
      body: JSON.stringify(list),
    });
  }
}

export const systemService = SystemService.getInstance();
