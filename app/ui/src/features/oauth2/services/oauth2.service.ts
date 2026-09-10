// OAuth2 resource-server service — every call goes through the backend
// proxy (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/oauth.rs); writes are wrapped in withStepUp by the
// calling components.

import { apiFetch } from '@/shared/services/http-client';
import { entryBody, type KanidmEntry } from '@/shared/types/kanidm';
import type {
  Oauth2RsDetail,
  Oauth2RsSummary,
} from '../types/oauth2.types';
import { toOauth2RsDetail, toOauth2RsSummary } from '../types/oauth2.types';

const BASE = '/api/kanidm/v1/oauth2';

/** Join strategy for claim-map values (vendor Oauth2ClaimMapJoin serde
 * renames: "csv" | "ssv" | "array", proto/src/internal/mod.rs:231). */
export type Oauth2ClaimMapJoin = 'csv' | 'ssv' | 'array';

export interface Oauth2UpdateChanges {
  name?: string;
  displayName?: string;
  landing?: string;
  resetSecret?: boolean;
}

class Oauth2Service {
  private static instance: Oauth2Service;

  private constructor() {}

  static getInstance(): Oauth2Service {
    if (!Oauth2Service.instance) {
      Oauth2Service.instance = new Oauth2Service();
    }
    return Oauth2Service.instance;
  }

  /** List all resource servers (GET /v1/oauth2, vendor idm_oauth2_rs_list). */
  async list(): Promise<Oauth2RsSummary[]> {
    const entries = await apiFetch<KanidmEntry[]>(BASE);
    return entries.map(toOauth2RsSummary);
  }

  /** Get one resource server by name or uuid (vendor idm_oauth2_rs_get). */
  async get(id: string): Promise<Oauth2RsDetail> {
    const entry = await apiFetch<KanidmEntry>(`${BASE}/${encodeURIComponent(id)}`);
    return toOauth2RsDetail(entry);
  }

  /**
   * Create a confidential client (vendor idm_oauth2_rs_basic_create,
   * POST /v1/oauth2/_basic). Attr keys verified against the vendored
   * 1.12 schema: oauth2_strict_redirect_uri (NOT oauth2_rs_strict_redirect_uri).
   */
  async createBasic(name: string, displayName: string, origin: string): Promise<void> {
    await apiFetch<void>(`${BASE}/_basic`, {
      method: 'POST',
      body: JSON.stringify(
        entryBody({
          name: [name],
          displayname: [displayName],
          oauth2_rs_origin_landing: [origin],
          oauth2_strict_redirect_uri: ['true'],
        })
      ),
    });
  }

  /** Create a public client (vendor idm_oauth2_rs_public_create). */
  async createPublic(name: string, displayName: string, origin: string): Promise<void> {
    await apiFetch<void>(`${BASE}/_public`, {
      method: 'POST',
      body: JSON.stringify(
        entryBody({
          name: [name],
          displayname: [displayName],
          oauth2_rs_origin_landing: [origin],
          oauth2_strict_redirect_uri: ['true'],
        })
      ),
    });
  }

  /**
   * Update (vendor idm_oauth2_rs_update, PATCH /v1/oauth2/{id}).
   * resetSecret purges oauth2_rs_basic_secret (empty vec = remove).
   */
  async update(id: string, changes: Oauth2UpdateChanges): Promise<void> {
    const attrs: Record<string, string[]> = {};
    if (changes.name !== undefined) attrs['name'] = [changes.name];
    if (changes.displayName !== undefined) attrs['displayname'] = [changes.displayName];
    if (changes.landing !== undefined) {
      attrs['oauth2_rs_origin_landing'] = [changes.landing];
    }
    if (changes.resetSecret) attrs['oauth2_rs_basic_secret'] = [];
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(entryBody(attrs)),
    });
  }

  /** Delete (vendor idm_oauth2_rs_delete, DELETE /v1/oauth2/{id}). */
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  /** Basic secret (vendor idm_oauth2_rs_get_basic_secret → string | null). */
  async getBasicSecret(id: string): Promise<string | null> {
    return apiFetch<string | null>(
      `${BASE}/${encodeURIComponent(id)}/_basic_secret`
    );
  }

  /** Set scope map (vendor idm_oauth2_rs_update_scope_map, body = scopes). */
  async updateScopeMap(id: string, group: string, scopes: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_scopemap/${encodeURIComponent(group)}`,
      { method: 'POST', body: JSON.stringify(scopes) }
    );
  }

  /** Delete scope map (vendor idm_oauth2_rs_delete_scope_map). */
  async deleteScopeMap(id: string, group: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_scopemap/${encodeURIComponent(group)}`,
      { method: 'DELETE' }
    );
  }

  /** Set supplemental scope map (vendor idm_oauth2_rs_update_sup_scope_map). */
  async updateSupScopeMap(id: string, group: string, scopes: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_sup_scopemap/${encodeURIComponent(group)}`,
      { method: 'POST', body: JSON.stringify(scopes) }
    );
  }

  /** Delete supplemental scope map (vendor idm_oauth2_rs_delete_sup_scope_map). */
  async deleteSupScopeMap(id: string, group: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_sup_scopemap/${encodeURIComponent(group)}`,
      { method: 'DELETE' }
    );
  }

  /** Set claim map (vendor idm_oauth2_rs_update_claim_map, body = values). */
  async updateClaimMap(
    id: string,
    claim: string,
    group: string,
    values: string[]
  ): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_claimmap/${encodeURIComponent(claim)}/${encodeURIComponent(group)}`,
      { method: 'POST', body: JSON.stringify(values) }
    );
  }

  /**
   * Set claim-map join strategy (vendor idm_oauth2_rs_update_claim_map_join,
   * POST /v1/oauth2/{id}/_claimmap/{claim}). The join value itself is the
   * request body — a bare JSON string ("csv" | "ssv" | "array") — NOT a
   * query param (verified: Oauth2ClaimMapJoin serde renames,
   * proto/src/internal/mod.rs:231).
   */
  async updateClaimMapJoin(
    id: string,
    claim: string,
    join: Oauth2ClaimMapJoin
  ): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_claimmap/${encodeURIComponent(claim)}`,
      { method: 'POST', body: JSON.stringify(join) }
    );
  }

  /** Delete claim map (vendor idm_oauth2_rs_delete_claim_map). */
  async deleteClaimMap(id: string, claim: string, group: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_claimmap/${encodeURIComponent(claim)}/${encodeURIComponent(group)}`,
      { method: 'DELETE' }
    );
  }

  /** Add an origin (vendor idm_oauth2_client_add_origin, body = [origin]). */
  async addOrigin(id: string, origin: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_attr/oauth2_rs_origin`,
      { method: 'POST', body: JSON.stringify([origin]) }
    );
  }

  /**
   * Remove an origin (vendor idm_oauth2_client_remove_origin — DELETE
   * with a JSON body of [origin]).
   */
  async removeOrigin(id: string, origin: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_attr/oauth2_rs_origin`,
      { method: 'DELETE', body: JSON.stringify([origin]) }
    );
  }

  /**
   * Upload the client image (vendor idm_oauth2_rs_update_image, POST
   * /v1/oauth2/{id}/_image). Multipart FormData with a single part named
   * "image" (filename + content-type from the file) — the reason the
   * http-client keeps the browser-generated multipart Content-Type.
   */
  async setImage(id: string, file: File): Promise<void> {
    const form = new FormData();
    form.append('image', file, file.name);
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}/_image`, {
      method: 'POST',
      body: form,
    });
  }

  /** Remove the client image (vendor idm_oauth2_rs_delete_image). */
  async removeImage(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}/_image`, {
      method: 'DELETE',
    });
  }

  /**
   * Direct <img src> URL for the client image (GET /api/kanidm/ui/images/
   * oauth2/{id}, served by the proxy's https/mod.rs fallback). NOT an
   * apiFetch call — the browser sends the session cookie and the proxy
   * attaches the bearer upstream.
   */
  imageUrl(id: string): string {
    return `/api/kanidm/ui/images/oauth2/${encodeURIComponent(id)}`;
  }

  /** Re-enable PKCE (vendor idm_oauth2_rs_enable_pkce — purge the attr). */
  async enablePkce(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_allow_insecure_client_disable_pkce: [] })
      ),
    });
  }

  /** Allow disabling PKCE (vendor idm_oauth2_rs_disable_pkce). */
  async disablePkce(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_allow_insecure_client_disable_pkce: ['true'] })
      ),
    });
  }

  /** Enable legacy crypto (vendor idm_oauth2_rs_enable_legacy_crypto). */
  async enableLegacyCrypto(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_jwt_legacy_crypto_enable: ['true'] })
      ),
    });
  }

  /** Disable legacy crypto (vendor idm_oauth2_rs_disable_legacy_crypto). */
  async disableLegacyCrypto(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_jwt_legacy_crypto_enable: ['false'] })
      ),
    });
  }

  /** Prefer short username (vendor idm_oauth2_rs_prefer_short_username). */
  async preferShortUsername(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_prefer_short_username: ['true'] })
      ),
    });
  }

  /** Prefer spn username (vendor idm_oauth2_rs_prefer_spn_username). */
  async preferSpnUsername(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_prefer_short_username: ['false'] })
      ),
    });
  }

  /** Allow localhost redirects (vendor idm_oauth2_rs_enable_public_localhost_redirect). */
  async enableLocalhostRedirect(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_allow_localhost_redirect: ['true'] })
      ),
    });
  }

  /** Disallow localhost redirects (vendor idm_oauth2_rs_disable_public_localhost_redirect). */
  async disableLocalhostRedirect(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_allow_localhost_redirect: ['false'] })
      ),
    });
  }

  /** Enable strict redirect-uri validation (vendor idm_oauth2_rs_enable_strict_redirect_uri). */
  async enableStrictRedirect(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_strict_redirect_uri: ['true'] })
      ),
    });
  }

  /** Disable strict redirect-uri validation (vendor idm_oauth2_rs_disable_strict_redirect_uri). */
  async disableStrictRedirect(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_strict_redirect_uri: ['false'] })
      ),
    });
  }

  /** Enable the consent prompt (vendor idm_oauth2_rs_enable_consent_prompt). */
  async enableConsentPrompt(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_consent_prompt_enable: ['true'] })
      ),
    });
  }

  /** Disable the consent prompt (vendor idm_oauth2_rs_disable_consent_prompt). */
  async disableConsentPrompt(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      body: JSON.stringify(
        entryBody({ oauth2_consent_prompt_enable: ['false'] })
      ),
    });
  }

  /**
   * Enable/disable the device flow (vendor
   * idm_oauth2_client_device_flow_update): enabled → PATCH
   * oauth2_device_flow_enable: ["true"]; disabled → DELETE the attr.
   */
  async setDeviceFlow(id: string, enabled: boolean): Promise<void> {
    if (enabled) {
      await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(
          entryBody({ oauth2_device_flow_enable: ['true'] })
        ),
      });
    } else {
      await apiFetch<void>(
        `${BASE}/${encodeURIComponent(id)}/_attr/oauth2_device_flow_enable`,
        { method: 'DELETE' }
      );
    }
  }

  /**
   * Set/clear the refresh-token expiry in seconds (vendor
   * idm_oauth2_rs_set_refresh_token_expiry): value → PATCH
   * oauth2_refresh_token_expiry: [String(seconds)]; null → DELETE the attr.
   */
  async setRefreshTokenExpiry(id: string, seconds: number | null): Promise<void> {
    if (seconds !== null) {
      await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(
          entryBody({ oauth2_refresh_token_expiry: [String(seconds)] })
        ),
      });
    } else {
      await apiFetch<void>(
        `${BASE}/${encodeURIComponent(id)}/_attr/oauth2_refresh_token_expiry`,
        { method: 'DELETE' }
      );
    }
  }

  /**
   * Rotate signing keys (vendor idm_oauth2_rs_rotate_keys, POST
   * /v1/oauth2/{id}/_attr/key_action_rotate). The vendor fn takes a
   * REQUIRED OffsetDateTime and sends it RFC3339-formatted inside the
   * values array; the Keys tab defaults the input to now.
   */
  async rotateKeys(id: string, rotateAtIso: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_attr/key_action_rotate`,
      { method: 'POST', body: JSON.stringify([rotateAtIso]) }
    );
  }

  /**
   * Revoke a signing key by id (vendor idm_oauth2_rs_revoke_key, POST
   * /v1/oauth2/{id}/_attr/key_action_revoke). There is NO list-keys
   * endpoint (CLI parity checked); the admin supplies the key id.
   */
  async revokeKey(id: string, keyId: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/${encodeURIComponent(id)}/_attr/key_action_revoke`,
      { method: 'POST', body: JSON.stringify([keyId]) }
    );
  }
}

export const oauth2Service = Oauth2Service.getInstance();
