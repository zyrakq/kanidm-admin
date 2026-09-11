// Person service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/person.rs + lib.rs); writes are wrapped in
// withStepUp by the calling components (D8).

import { ApiError, apiFetch } from '@/shared/services/http-client';
import { entryBody, type KanidmEntry } from '@/shared/types/kanidm';
import type {
  CredentialStatusView,
  PersonDetail,
  PersonSummary,
  SessionItem,
  UnixUserTokenView,
} from '../types/person.types';
import { toPersonDetail, toPersonSummary } from '../types/person.types';

const BASE = '/api/kanidm/v1';

class PersonService {
  private static instance: PersonService;

  private constructor() {}

  static getInstance(): PersonService {
    if (!PersonService.instance) {
      PersonService.instance = new PersonService();
    }
    return PersonService.instance;
  }

  /** List all persons (GET /v1/person, vendor idm_person_account_list). */
  async list(): Promise<PersonSummary[]> {
    const entries = await apiFetch<KanidmEntry[]>(`${BASE}/person`);
    return entries.map(toPersonSummary);
  }

  /** Get one person by name or uuid (vendor idm_person_account_get). */
  async get(id: string): Promise<PersonDetail> {
    // Kanidm v1 returns HTTP 200 with body `null` for a missing entry.
    const entry = await apiFetch<KanidmEntry | null>(
      `${BASE}/person/${encodeURIComponent(id)}`
    );
    if (entry === null) {
      throw new ApiError('not_found', 'Not found.', 404);
    }
    return toPersonDetail(entry);
  }

  /** Create (vendor idm_person_account_create: attrs name+displayname). */
  async create(id: string, displayName: string): Promise<void> {
    await apiFetch<void>(`${BASE}/person`, {
      method: 'POST',
      body: JSON.stringify(
        entryBody({ name: [id], displayname: [displayName] })
      ),
    });
  }

  /**
   * Update (vendor idm_person_account_update, PATCH /v1/person/{id}).
   * An empty-string legalName purges the attribute (kanidm PATCH: empty
   * vec = remove); pass null to leave a field untouched.
   */
  async update(
    id: string,
    changes: {
      displayName?: string;
      legalName?: string | null; // '' = purge, undefined = keep
      mail?: string[];
    }
  ): Promise<void> {
    const attrs: Record<string, string[]> = {};
    if (changes.displayName !== undefined) {
      attrs.displayname = [changes.displayName];
    }
    if (changes.legalName === '') {
      attrs.legalname = [];
    } else if (changes.legalName != null) {
      attrs.legalname = [changes.legalName];
    }
    if (changes.mail !== undefined) {
      attrs.mail = changes.mail;
    }
    await apiFetch<void>(`${BASE}/person/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(entryBody(attrs)),
    });
  }

  /** Delete (vendor idm_person_account_delete). */
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/person/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /** Generic attribute write (vendor person _attr ops). */
  async setAttr(id: string, attr: string, values: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/person/${encodeURIComponent(id)}/_attr/${encodeURIComponent(attr)}`,
      { method: 'PUT', body: JSON.stringify(values) }
    );
  }

  /** Credential status (vendor idm_person_account_get_credential_status). */
  async credentialStatus(id: string): Promise<CredentialStatusView> {
    return apiFetch<CredentialStatusView>(
      `${BASE}/person/${encodeURIComponent(id)}/_credential/_status`
    );
  }

  /**
   * Credential update intent (vendor idm_person_account_credential_update_intent):
   * GET /v1/person/{id}/_credential/_update_intent[/{ttl}] -> CUIntentToken.
   */
  async credentialUpdateIntent(id: string, ttl?: number): Promise<string> {
    const suffix = ttl !== undefined ? `/${ttl}` : '';
    const response = await apiFetch<{ token: string }>(
      `${BASE}/person/${encodeURIComponent(id)}/_credential/_update_intent${suffix}`
    );
    return response.token;
  }

  /**
   * Email the credential update intent (vendor
   * idm_person_account_credential_update_send_intent: body {ttl, email}).
   */
  async sendCredentialIntent(
    id: string,
    ttl: number,
    email: string | null
  ): Promise<void> {
    await apiFetch<void>(
      `${BASE}/person/${encodeURIComponent(id)}/_credential/_update_intent_send`,
      { method: 'POST', body: JSON.stringify({ ttl, email }) }
    );
  }

  /** Active sessions (vendor idm_account_list_user_auth_token). */
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
   * List ssh keys as "tag: key" strings. Uses the entry attr endpoint:
   * the dedicated _ssh_pubkeys list returns bare keys without tags, but
   * removal is tag-based (DELETE /_ssh_pubkeys/{tag}), so tags are
   * required (v1 proto serialization: format!("{tag}: {pk}")).
   */
  async sshKeys(id: string): Promise<string[]> {
    // Empty attr returns HTTP 200 with body `null` (not []).
    return (await apiFetch<string[] | null>(
      `${BASE}/person/${encodeURIComponent(id)}/_attr/ssh_publickey`
    )) ?? [];
  }

  /** Add ssh key (vendor idm_person_account_post_ssh_pubkey: [tag, key]). */
  async addSshKey(id: string, tag: string, pubkey: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/person/${encodeURIComponent(id)}/_ssh_pubkeys`,
      { method: 'POST', body: JSON.stringify([tag, pubkey]) }
    );
  }

  /** Remove ssh key (vendor idm_person_account_delete_ssh_pubkey). */
  async removeSshKey(id: string, tag: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/person/${encodeURIComponent(id)}/_ssh_pubkeys/${encodeURIComponent(tag)}`,
      { method: 'DELETE' }
    );
  }

  /** POSIX show (vendor idm_account_unix_token_get -> UnixUserToken). */
  async posixShow(id: string): Promise<UnixUserTokenView> {
    return apiFetch<UnixUserTokenView>(
      `/api/kanidm/v1/account/${encodeURIComponent(id)}/_unix/_token`
    );
  }

  /** POSIX set (vendor idm_person_account_unix_extend: {shell, gidnumber}). */
  async posixSet(
    id: string,
    gidnumber: number | null,
    shell: string | null
  ): Promise<void> {
    await apiFetch<void>(
      `${BASE}/person/${encodeURIComponent(id)}/_unix`,
      {
        method: 'POST',
        body: JSON.stringify({ shell, gidnumber }),
      }
    );
  }

  /** POSIX password (vendor idm_person_account_unix_cred_put: PUT
   * /v1/person/{id}/_unix/_credential with SingleStringRequest {value}). */
  async posixSetPassword(id: string, password: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/person/${encodeURIComponent(id)}/_unix/_credential`,
      { method: 'PUT', body: JSON.stringify({ value: password }) }
    );
  }

  /** RADIUS secret get (vendor idm_account_radius_credential_get -> string|null). */
  async radiusGet(id: string): Promise<string | null> {
    return apiFetch<string | null>(
      `${BASE}/person/${encodeURIComponent(id)}/_radius`
    );
  }

  /**
   * RADIUS regenerate (vendor idm_account_radius_credential_regenerate:
   * POST with an empty body serialized as JSON null, matching the
   * vendored client's unit request).
   */
  async radiusRegenerate(id: string): Promise<string> {
    return apiFetch<string>(
      `${BASE}/person/${encodeURIComponent(id)}/_radius`,
      { method: 'POST', body: 'null' }
    );
  }

  /** RADIUS delete (vendor idm_account_radius_credential_delete). */
  async radiusDelete(id: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/person/${encodeURIComponent(id)}/_radius`,
      { method: 'DELETE' }
    );
  }

  /** Group membership quick-ops via group attr endpoints (design: person
   * detail manages memberof). POST appends; DELETE removes the person
   * from the group's member attr (DELETE-with-body, as the vendored
   * client does via perform_delete_request_with_body). */
  async addToGroup(groupId: string, personId: string): Promise<void> {
    await apiFetch<void>(
      `/api/kanidm/v1/group/${encodeURIComponent(groupId)}/_attr/member`,
      { method: 'POST', body: JSON.stringify([personId]) }
    );
  }

  async removeFromGroup(groupId: string, personId: string): Promise<void> {
    await apiFetch<void>(
      `/api/kanidm/v1/group/${encodeURIComponent(groupId)}/_attr/member`,
      { method: 'DELETE', body: JSON.stringify([personId]) }
    );
  }
}

export const personService = PersonService.getInstance();
