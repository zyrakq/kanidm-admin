// Service account view models mapped from Kanidm entries + the small
// typed responses the service-account endpoints return. Wire shapes
// mirror kanidm_proto (verified against vendor sources): snake_case
// field names, lowercase externally-tagged enums.

import type { KanidmEntry } from '@/shared/types/kanidm';
import { attrFirst, attrList } from '@/shared/types/kanidm';

/** Row model for the service accounts list. */
export interface ServiceAccountSummary {
  id: string;
  displayName: string;
  mail: string | null;
}

/** Full service account detail (entry attrs projected). */
export interface ServiceAccountDetail {
  id: string;
  uuid: string | null;
  displayName: string;
  description: string | null;
  mail: string[];
  memberOf: string[];
  accountExpire: string | null;
  accountValidFrom: string | null;
  raw: KanidmEntry;
}

/** Map a v1 entry to the summary row. */
export function toServiceAccountSummary(
  entry: KanidmEntry
): ServiceAccountSummary {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    displayName: attrFirst(entry, 'displayname') ?? '',
    mail: attrFirst(entry, 'mail') ?? null,
  };
}

/** Map a v1 entry to the detail model. */
export function toServiceAccountDetail(
  entry: KanidmEntry
): ServiceAccountDetail {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    uuid: attrFirst(entry, 'uuid') ?? null,
    displayName: attrFirst(entry, 'displayname') ?? '',
    description: attrFirst(entry, 'description') ?? null,
    mail: attrList(entry, 'mail'),
    memberOf: attrList(entry, 'memberof'),
    accountExpire: attrFirst(entry, 'account_expire') ?? null,
    accountValidFrom: attrFirst(entry, 'account_valid_from') ?? null,
    raw: entry,
  };
}

/**
 * API token purpose (kanidm_proto internal ApiTokenPurpose, lowercase
 * externally-tagged enum with serde default).
 */
export type ApiTokenPurpose = 'readonly' | 'readwrite' | 'synchronise';

/**
 * One API token (GET /v1/service_account/{id}/_api_token items ->
 * kanidm_proto::internal::ApiToken). Wire keys are snake_case: the
 * label field is `label` (not name) and the token id is `token_id`.
 * expiry/issued_at are unix timestamps in seconds; expiry is null
 * when the token never expires.
 */
export interface ApiTokenView {
  account_id: string;
  token_id: string;
  label: string;
  expiry: number | null;
  issued_at: number;
  purpose: ApiTokenPurpose;
}

/**
 * CredentialDetailType (kanidm_proto CredentialDetailType): an
 * externally-tagged serde enum — unit variants serialize as PascalCase
 * strings, tuple variants as single-key objects.
 */
export type CredentialDetailType =
  | 'Password'
  | 'GeneratedPassword'
  | { Passkey: string[] }
  | { PasswordMfa: [string[], string[], number] };

/**
 * Credential status (GET .../_credential/_status -> CredentialStatus):
 * { creds: [{ uuid, type_ }] } — the wire key is literally "type_".
 */
export interface CredentialStatusView {
  creds: Array<{ uuid: string; type_: CredentialDetailType }>;
}

/** Session state (UatStatusState, lowercase externally-tagged enum). */
export type UatStatusState = { expiresat: number } | 'neverexpires' | 'revoked';

/** Session purpose (UatPurposeStatus, lowercase enum). */
export type UatPurposeStatus = 'readonly' | 'readwrite' | 'privilegecapable';

/**
 * One active session (GET /v1/account/{id}/_user_auth_token items ->
 * UatStatus). issued_at is a unix timestamp in seconds.
 */
export interface SessionItem {
  account_id: string;
  session_id: string;
  state: UatStatusState;
  issued_at: number;
  purpose: UatPurposeStatus;
}

/**
 * POSIX token view (GET /v1/account/{id}/_unix/_token -> UnixUserToken).
 * Wire keys are snake_case; shell is omitted from the JSON when unset.
 */
export interface UnixUserTokenView {
  name: string;
  spn: string;
  displayname: string;
  gidnumber: number;
  shell?: string | null;
  uuid: string;
}
