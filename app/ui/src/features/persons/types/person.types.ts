// Person view models mapped from Kanidm entries + the small typed
// responses the person endpoints return. Wire shapes mirror
// kanidm_proto (verified against vendor sources): snake_case field
// names, externally-tagged enums.

import type { KanidmEntry } from '@/shared/types/kanidm';
import { attrFirst, attrList } from '@/shared/types/kanidm';

/** Row model for the persons list. */
export interface PersonSummary {
  id: string;
  displayName: string;
  mail: string | null;
}

/** Full person detail (entry attrs projected). */
export interface PersonDetail {
  id: string;
  displayName: string;
  legalName: string | null;
  mail: string[];
  memberOf: string[];
  uuid: string | null;
  accountExpire: string | null;
  accountValidFrom: string | null;
  raw: KanidmEntry;
}

/** Map a v1 entry to the summary row. */
export function toPersonSummary(entry: KanidmEntry): PersonSummary {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    displayName: attrFirst(entry, 'displayname') ?? '',
    mail: attrFirst(entry, 'mail') ?? null,
  };
}

/** Map a v1 entry to the detail model. */
export function toPersonDetail(entry: KanidmEntry): PersonDetail {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    displayName: attrFirst(entry, 'displayname') ?? '',
    legalName: attrFirst(entry, 'legalname') ?? null,
    mail: attrList(entry, 'mail'),
    memberOf: attrList(entry, 'memberof'),
    uuid: attrFirst(entry, 'uuid') ?? null,
    accountExpire: attrFirst(entry, 'account_expire') ?? null,
    accountValidFrom: attrFirst(entry, 'account_valid_from') ?? null,
    raw: entry,
  };
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
export type UatStatusState =
  | { expiresat: number }
  | 'neverexpires'
  | 'revoked';

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

/**
 * Request actions for the credential-update session (vendor CURequest,
 * an externally-tagged serde enum with `rename_all = "lowercase"`):
 * unit variants serialize as bare lowercase strings ("primaryremove"),
 * single-arg variants as single-key objects ({"totpremove": "label"}).
 */
export type CredentialUpdateRequest =
  | 'primaryremove'
  | 'cancelmfareg'
  | { totpremove: string };

/**
 * CredentialDetail inside a CUStatus (vendor CredentialDetail).
 */
export interface CredentialDetail {
  uuid: string;
  type_: CredentialDetailType;
}

/** Native state hint (CUCredState, PascalCase enum). */
export type CUCredState =
  | 'Modifiable'
  | 'DeleteOnly'
  | 'AccessDeny'
  | 'PolicyDeny';

/**
 * MFA registration state (CURegState, externally-tagged PascalCase enum
 * with no rename attr). Payload variants are typed loosely — the UI
 * never needs their contents, only that registration is/ isn't in
 * progress.
 */
export type CURegState =
  | 'None'
  | 'TotpTryAgain'
  | 'TotpInvalidSha1'
  | { TotpCheck: unknown }
  | { TotpNameTryAgain: string }
  | { BackupCodes: string[] }
  | { Passkey: unknown }
  | { AttestedPasskey: unknown };

/**
 * CUStatus view (vendor CUStatus from a credential-update session:
 * begin/status/action all return it; snake_case fields, PascalCase
 * enums). Only the fields the UI consumes are typed; the rest of the
 * wire object (passkeys, unixcred, sshkeys, …) is ignored.
 */
export interface CredentialUpdateStatusView {
  spn: string;
  displayname: string;
  mfaregstate: CURegState;
  can_commit: boolean;
  /** CURegWarning unit variants, PascalCase strings. */
  warnings: string[];
  dirty: boolean;
  primary: CredentialDetail | null;
  primary_state: CUCredState;
}
