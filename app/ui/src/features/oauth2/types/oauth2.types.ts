// OAuth2 resource-server wire types and entry mappers.
//
// Attr names verified against vendor/kanidm/proto/src/constants.rs.
// NOTE: the vendored 1.12 schema uses `oauth2_strict_redirect_uri`
// (ATTR_OAUTH2_STRICT_REDIRECT_URI, constants.rs:191) — NOT the older
// `oauth2_rs_strict_redirect_uri`. The Docker integration test
// (app/src/proxy/integration.rs) confirmed the same rename on the wire.

import type { KanidmEntry } from '@/shared/types/kanidm';
import { attrFirst, attrList, hasAttr } from '@/shared/types/kanidm';

export interface Oauth2RsSummary {
  id: string;
  displayName: string;
  /** First oauth2_rs_origin value. */
  origin: string | null;
  /** class contains 'oauth2_resource_server_public' (constants.rs:317). */
  isPublic: boolean;
}

export interface ScopeMap {
  group: string;
  scopes: string[];
}

export interface ClaimMap {
  claim: string;
  group: string;
  values: string[];
}

export interface Oauth2RsDetail {
  id: string;
  uuid: string | null;
  displayName: string;
  origins: string[];
  landingOrigin: string | null;
  isPublic: boolean;
  /** true when oauth2_rs_basic_secret is present (confidential clients). */
  basicSecretPresent: boolean;
  // Toggle states, each derived from attr presence/value:
  pkceDisabled: boolean; // oauth2_allow_insecure_client_disable_pkce present
  strictRedirect: boolean; // oauth2_strict_redirect_uri === 'true'
  localhostRedirect: boolean; // oauth2_allow_localhost_redirect === 'true'
  legacyCrypto: boolean; // oauth2_jwt_legacy_crypto_enable === 'true'
  preferShortUsername: boolean; // oauth2_prefer_short_username === 'true'
  consentPrompt: boolean; // oauth2_consent_prompt_enable === 'true'
  deviceFlow: boolean; // oauth2_device_flow_enable === 'true'
  refreshTokenExpiry: number | null; // oauth2_refresh_token_expiry (seconds)
  scopeMaps: ScopeMap[];
  supScopeMaps: ScopeMap[];
  claimMaps: ClaimMap[];
  raw: KanidmEntry;
}

/**
 * Parse a `group:scope`-shaped scope-map value. Group spns contain '@'
 * but never ':', so split at the FIRST ':' only. When the live format
 * differs, the UI falls back to rendering raw values (see caveat in the
 * plan) — here an unparseable value yields a group with no scopes.
 */
function toScopeMap(value: string): ScopeMap {
  const idx = value.indexOf(':');
  if (idx === -1) {
    return { group: value, scopes: [] };
  }
  return {
    group: value.slice(0, idx),
    scopes: value
      .slice(idx + 1)
      .split(' ')
      .filter((s) => s.length > 0),
  };
}

/**
 * Parse a `claim:group:value`-shaped claim-map value. Split at the first
 * two ':'; the remainder is the raw value list (space separated).
 */
function toClaimMap(value: string): ClaimMap {
  const first = value.indexOf(':');
  if (first === -1) {
    return { claim: value, group: '', values: [] };
  }
  const second = value.indexOf(':', first + 1);
  if (second === -1) {
    return { claim: value.slice(0, first), group: value.slice(first + 1), values: [] };
  }
  return {
    claim: value.slice(0, first),
    group: value.slice(first + 1, second),
    values: value
      .slice(second + 1)
      .split(' ')
      .filter((s) => s.length > 0),
  };
}

function toScopeMaps(entry: KanidmEntry, attr: string): ScopeMap[] {
  return attrList(entry, attr).map(toScopeMap);
}

function toClaimMaps(entry: KanidmEntry): ClaimMap[] {
  return attrList(entry, 'oauth2_rs_claim_map').map(toClaimMap);
}

function isTrue(entry: KanidmEntry, attr: string): boolean {
  return attrFirst(entry, attr) === 'true';
}

export function toOauth2RsSummary(entry: KanidmEntry): Oauth2RsSummary {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    displayName: attrFirst(entry, 'displayname') ?? '',
    origin: attrFirst(entry, 'oauth2_rs_origin') ?? null,
    isPublic: entry.attrs['class']?.includes('oauth2_resource_server_public') ?? false,
  };
}

export function toOauth2RsDetail(entry: KanidmEntry): Oauth2RsDetail {
  const expiryRaw = attrFirst(entry, 'oauth2_refresh_token_expiry');
  const expiry = expiryRaw !== undefined ? Number(expiryRaw) : NaN;
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    uuid: attrFirst(entry, 'uuid') ?? null,
    displayName: attrFirst(entry, 'displayname') ?? '',
    origins: attrList(entry, 'oauth2_rs_origin'),
    landingOrigin: attrFirst(entry, 'oauth2_rs_origin_landing') ?? null,
    isPublic: entry.attrs['class']?.includes('oauth2_resource_server_public') ?? false,
    basicSecretPresent: hasAttr(entry, 'oauth2_rs_basic_secret'),
    pkceDisabled: hasAttr(entry, 'oauth2_allow_insecure_client_disable_pkce'),
    strictRedirect: isTrue(entry, 'oauth2_strict_redirect_uri'),
    localhostRedirect: isTrue(entry, 'oauth2_allow_localhost_redirect'),
    legacyCrypto: isTrue(entry, 'oauth2_jwt_legacy_crypto_enable'),
    preferShortUsername: isTrue(entry, 'oauth2_prefer_short_username'),
    consentPrompt: isTrue(entry, 'oauth2_consent_prompt_enable'),
    deviceFlow: isTrue(entry, 'oauth2_device_flow_enable'),
    refreshTokenExpiry: Number.isFinite(expiry) ? expiry : null,
    scopeMaps: toScopeMaps(entry, 'oauth2_rs_scope_map'),
    supScopeMaps: toScopeMaps(entry, 'oauth2_rs_sup_scope_map'),
    claimMaps: toClaimMaps(entry),
    raw: entry,
  };
}
