// Group view models mapped from Kanidm v1 entries. Wire shapes mirror
// kanidm_proto (verified against vendor sources): attrs are snake_case
// keys with list values.

import type { KanidmEntry } from '@/shared/types/kanidm';
import { attrFirst, attrList, hasAttr } from '@/shared/types/kanidm';

/** Row model for the groups list. */
export interface GroupSummary {
  id: string;
  displayName: string | null;
  memberCount: number;
  isPosix: boolean;
  /** True when the entry carries class=builtin (Kanidm base plugin marker). */
  isSystem: boolean;
}

/**
 * System-group marker: the Kanidm base plugin adds class=builtin to every
 * internally-created entry (vendor/kanidm/server/lib/src/plugins/base.rs).
 * Missing or malformed class attr → NOT system (fail open).
 */
export function isSystemEntry(entry: KanidmEntry): boolean {
  return attrList(entry, 'class').includes('builtin');
}

/** Full group detail (entry attrs projected). */
export interface GroupDetail {
  id: string;
  uuid: string | null;
  displayName: string | null;
  description: string | null;
  members: string[];
  mail: string[];
  entryManagedBy: string | null;
  isPosix: boolean;
  isAccountPolicy: boolean;
  raw: KanidmEntry;
}

/** Map a v1 entry to the summary row. */
export function toGroupSummary(entry: KanidmEntry): GroupSummary {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    displayName: attrFirst(entry, 'displayname') ?? null,
    memberCount: attrList(entry, 'member').length,
    isPosix: hasAttr(entry, 'gidnumber'),
    isSystem: isSystemEntry(entry),
  };
}

/** Map a v1 entry to the detail model. */
export function toGroupDetail(entry: KanidmEntry): GroupDetail {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    uuid: attrFirst(entry, 'uuid') ?? null,
    displayName: attrFirst(entry, 'displayname') ?? null,
    description: attrFirst(entry, 'description') ?? null,
    members: attrList(entry, 'member'),
    mail: attrList(entry, 'mail'),
    entryManagedBy: attrFirst(entry, 'entry_managed_by') ?? null,
    isPosix: hasAttr(entry, 'gidnumber'),
    isAccountPolicy: entry.attrs['class']?.includes('account_policy') ?? false,
    raw: entry,
  };
}

/**
 * Account-policy attribute wire names, verified against
 * vendor/kanidm/proto/src/constants.rs ATTR_* constants. The server's
 * `_attr/{attr}` route matches these exact snake_case strings.
 */
export const ACCOUNT_POLICY_ATTRS = {
  authSessionExpiry: 'authsession_expiry',
  privilegeExpiry: 'privilege_expiry',
  authPasswordMinimumLength: 'auth_password_minimum_length',
  credentialTypeMinimum: 'credential_type_minimum',
  webauthnAttestationCaList: 'webauthn_attestation_ca_list',
  limitSearchMaxResults: 'limit_search_max_results',
  limitSearchMaxFilterTest: 'limit_search_max_filter_test',
  allowPrimaryCredFallback: 'allow_primary_cred_fallback',
} as const;
