// Service account service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/service_account.rs + lib.rs); writes are wrapped in
// withStepUp by the calling components (D8).

import { apiFetch } from '@/shared/services/http-client';
import { entryBody, type KanidmEntry } from '@/shared/types/kanidm';
import type {
  ApiTokenView,
  CredentialStatusView,
  ServiceAccountDetail,
  ServiceAccountSummary,
  SessionItem,
  UnixUserTokenView,
} from '../types/service-account.types';
import {
  toServiceAccountDetail,
  toServiceAccountSummary,
} from '../types/service-account.types';

const BASE = '/api/kanidm/v1';

class ServiceAccountService {
  private static instance: ServiceAccountService;

  private constructor() {}

  static getInstance(): ServiceAccountService {
    if (!ServiceAccountService.instance) {
      ServiceAccountService.instance = new ServiceAccountService();
    }
    return ServiceAccountService.instance;
  }

  /** List all service accounts (GET /v1/service_account, vendor idm_service_account_list). */
  async list(): Promise<ServiceAccountSummary[]> {
    const entries = await apiFetch<KanidmEntry[]>(`${BASE}/service_account`);
    return entries.map(toServiceAccountSummary);
  }

  /** Get one service account by name or uuid (vendor idm_service_account_get). */
  async get(id: string): Promise<ServiceAccountDetail> {
    const entry = await apiFetch<KanidmEntry>(
      `${BASE}/service_account/${encodeURIComponent(id)}`
    );
    return toServiceAccountDetail(entry);
  }

  /** Create (vendor idm_service_account_create: attrs name+displayname). */
  async create(id: string, displayName: string): Promise<void> {
    await apiFetch<void>(`${BASE}/service_account`, {
      method: 'POST',
      body: JSON.stringify(
        entryBody({ name: [id], displayname: [displayName] })
      ),
    });
  }

  /**
   * Update (vendor idm_service_account_update, PATCH /v1/service_account/{id}).
   * An empty-string field purges the attribute (kanidm PATCH: empty vec
   * = remove); pass null to leave a field untouched.
   */
  async update(
    id: string,
    changes: {
      displayName?: string;
      description?: string | null; // '' = purge, undefined = keep
      mail?: string[];
    }
  ): Promise<void> {
    const attrs: Record<string, string[]> = {};
    if (changes.displayName !== undefined) {
      attrs.displayname = [changes.displayName];
    }
    if (changes.description === '') {
      attrs.description = [];
    } else if (changes.description != null) {
      attrs.description = [changes.description];
    }
    if (changes.mail !== undefined) {
      attrs.mail = changes.mail;
    }
    await apiFetch<void>(`${BASE}/service_account/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(entryBody(attrs)),
    });
  }

  /** Delete (vendor idm_service_account_delete). */
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/service_account/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /** Generic attribute write (vendor idm_service_account_set_attr). */
  async setAttr(id: string, attr: string, values: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_attr/${encodeURIComponent(attr)}`,
      { method: 'PUT', body: JSON.stringify(values) }
    );
  }

  /** Purge an attribute (vendor idm_service_account_purge_attr). */
  async purgeAttr(id: string, attr: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_attr/${encodeURIComponent(attr)}`,
      { method: 'DELETE' }
    );
  }

  /** Credential status (vendor idm_service_account_get_credential_status). */
  async credentialStatus(id: string): Promise<CredentialStatusView> {
    return apiFetch<CredentialStatusView>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_credential/_status`
    );
  }

  /**
   * Generate a password (vendor idm_service_account_generate_password:
   * GET .../_credential/_generate -> the raw password string, shown
   * to the admin exactly once).
   */
  async generatePassword(id: string): Promise<string> {
    return apiFetch<string>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_credential/_generate`
    );
  }

  /** List API tokens (vendor idm_service_account_list_api_token -> ApiToken[]). */
  async listApiTokens(id: string): Promise<ApiTokenView[]> {
    return apiFetch<ApiTokenView[]>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_api_token`
    );
  }

  /**
   * Create an API token (vendor idm_service_account_generate_api_token:
   * POST .../_api_token with ApiTokenGenerate { label, expiry,
   * read_write, compact } — an object, not a bare label string; expiry
   * is a unix timestamp in seconds or null for "never"). Returns the
   * raw token string, displayed exactly once.
   */
  async createApiToken(
    id: string,
    options: { label: string; expiry?: number | null; readWrite?: boolean }
  ): Promise<string> {
    return apiFetch<string>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_api_token`,
      {
        method: 'POST',
        body: JSON.stringify({
          label: options.label,
          expiry: options.expiry ?? null,
          read_write: options.readWrite ?? false,
          compact: false,
        }),
      }
    );
  }

  /** Destroy an API token (vendor idm_service_account_destroy_api_token). */
  async destroyApiToken(id: string, tokenId: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(
        id
      )}/_api_token/${encodeURIComponent(tokenId)}`,
      { method: 'DELETE' }
    );
  }

  /**
   * List ssh keys as "tag: key" strings. Uses the entry attr endpoint:
   * the dedicated _ssh_pubkeys list returns bare keys without tags, but
   * removal is tag-based (DELETE /_ssh_pubkeys/{tag}), so tags are
   * required (v1 proto serialization: format!("{tag}: {pk}")).
   */
  async sshKeys(id: string): Promise<string[]> {
    return apiFetch<string[]>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_attr/ssh_publickey`
    );
  }

  /** Add ssh key (vendor idm_service_account_post_ssh_pubkey: [tag, key]). */
  async addSshKey(id: string, tag: string, pubkey: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_ssh_pubkeys`,
      { method: 'POST', body: JSON.stringify([tag, pubkey]) }
    );
  }

  /** Remove ssh key (vendor idm_service_account_delete_ssh_pubkey). */
  async removeSshKey(id: string, tag: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_ssh_pubkeys/${encodeURIComponent(tag)}`,
      { method: 'DELETE' }
    );
  }

  /** POSIX show (vendor idm_account_unix_token_get -> UnixUserToken). */
  async posixShow(id: string): Promise<UnixUserTokenView> {
    return apiFetch<UnixUserTokenView>(
      `/api/kanidm/v1/account/${encodeURIComponent(id)}/_unix/_token`
    );
  }

  /** POSIX set (vendor idm_service_account_unix_extend: {shell, gidnumber}). */
  async posixSet(
    id: string,
    gidnumber: number | null,
    shell: string | null
  ): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_unix`,
      {
        method: 'POST',
        body: JSON.stringify({ shell, gidnumber }),
      }
    );
  }

  /** POSIX password (same wire shape as the person unix cred put:
   * PUT /v1/service_account/{id}/_unix/_credential with
   * SingleStringRequest {value}). */
  async posixSetPassword(id: string, password: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_unix/_credential`,
      { method: 'PUT', body: JSON.stringify({ value: password }) }
    );
  }

  /** Active sessions (vendor idm_account_list_user_auth_token — the
   * shared /v1/account endpoints, same as persons). */
  async sessions(id: string): Promise<SessionItem[]> {
    return apiFetch<SessionItem[]>(
      `/api/kanidm/v1/account/${encodeURIComponent(id)}/_user_auth_token`
    );
  }

  /** Destroy one session (vendor idm_account_destroy_user_auth_token). */
  async destroySession(id: string, tokenId: string): Promise<void> {
    await apiFetch<void>(
      `/api/kanidm/v1/account/${encodeURIComponent(
        id
      )}/_user_auth_token/${encodeURIComponent(tokenId)}`,
      { method: 'DELETE' }
    );
  }

  /**
   * Convert the service account into a person (vendor
   * idm_service_account_into_person: POST with an empty body serialized
   * as JSON null, matching the vendored client's unit request).
   */
  async intoPerson(id: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/service_account/${encodeURIComponent(id)}/_into_person`,
      { method: 'POST', body: 'null' }
    );
  }
}

export const serviceAccountService = ServiceAccountService.getInstance();
