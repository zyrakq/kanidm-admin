// Sync-account service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/sync_account.rs); writes are wrapped in withStepUp by
// the calling components.
//
// NOTE: the vendored client has NO sync-account delete function — v1
// ships without delete (deliberate), so this service intentionally has
// no remove() either.

import { apiFetch } from '@/shared/services/http-client';
import { entryBody, type KanidmEntry } from '@/shared/types/kanidm';
import type {
  SyncAccountDetail,
  SyncAccountSummary,
} from '../types/sync-account.types';
import {
  toSyncAccountDetail,
  toSyncAccountSummary,
} from '../types/sync-account.types';

const BASE = '/api/kanidm/v1/sync_account';

class SyncAccountService {
  private static instance: SyncAccountService;

  private constructor() {}

  static getInstance(): SyncAccountService {
    if (!SyncAccountService.instance) {
      SyncAccountService.instance = new SyncAccountService();
    }
    return SyncAccountService.instance;
  }

  /** List all sync accounts (GET /v1/sync_account, vendor idm_sync_account_list). */
  async list(): Promise<SyncAccountSummary[]> {
    const entries = await apiFetch<KanidmEntry[]>(BASE);
    return entries.map(toSyncAccountSummary);
  }

  /** Get one sync account by name or uuid (vendor idm_sync_account_get). */
  async get(id: string): Promise<SyncAccountDetail> {
    const entry = await apiFetch<KanidmEntry>(`${BASE}/${encodeURIComponent(id)}`);
    return toSyncAccountDetail(entry);
  }

  /** Create (vendor idm_sync_account_create, POST /v1/sync_account). */
  async create(id: string, description?: string): Promise<void> {
    const attrs: Record<string, string[]> = { name: [id] };
    if (description !== undefined && description.length > 0) {
      attrs['description'] = [description];
    }
    await apiFetch<void>(BASE, {
      method: 'POST',
      body: JSON.stringify(entryBody(attrs)),
    });
  }

  /**
   * Set/clear the credential portal (vendor
   * idm_sync_account_set_credential_portal, PUT
   * /v1/sync_account/{id}/_attr/sync_credential_portal). url → [url];
   * null → [] (empty vec clears the attr).
   */
  async setCredentialPortal(id: string, url: string | null): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_attr/sync_credential_portal`,
      { method: 'PUT', body: JSON.stringify(url ? [url] : []) }
    );
  }

  /**
   * Set yield attributes (vendor idm_sync_account_set_yield_attributes,
   * PUT /v1/sync_account/{id}/_attr/sync_yield_authority, body = [...]).
   */
  async setYieldAttributes(id: string, attrs: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_attr/sync_yield_authority`,
      { method: 'PUT', body: JSON.stringify(attrs) }
    );
  }

  /**
   * Generate a sync token (vendor idm_sync_account_generate_token, POST
   * /v1/sync_account/{id}/_sync_token). The request body is a BARE JSON
   * string (the label) — NOT an object — and the response is the token
   * string itself. The token is displayed ONCE; the server never returns
   * it again.
   */
  async generateToken(id: string, label: string): Promise<string> {
    return apiFetch<string>(`${BASE}/${encodeURIComponent(id)}/_sync_token`, {
      method: 'POST',
      body: JSON.stringify(label),
    });
  }

  /** Destroy the sync token (vendor idm_sync_account_destroy_token, DELETE /v1/sync_account/{id}/_sync_token). */
  async destroyToken(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}/_sync_token`, {
      method: 'DELETE',
    });
  }

  /**
   * Force a refresh (vendor idm_sync_account_force_refresh, PATCH
   * /v1/sync_account/{id} with { attrs: { sync_cookie: [] } }).
   */
  async forceRefresh(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(entryBody({ sync_cookie: [] })),
    });
  }

  /**
   * Finalise (vendor idm_sync_account_finalise, GET
   * /v1/sync_account/{id}/_finalise). Converts all synced entries into
   * static persons/groups — irreversible.
   */
  async finalise(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}/_finalise`, {
      method: 'GET',
    });
  }

  /**
   * Terminate (vendor idm_sync_account_terminate, GET
   * /v1/sync_account/{id}/_terminate). Deletes all synced entries —
   * irreversible.
   */
  async terminate(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}/_terminate`, {
      method: 'GET',
    });
  }
}

export const syncAccountService = SyncAccountService.getInstance();
