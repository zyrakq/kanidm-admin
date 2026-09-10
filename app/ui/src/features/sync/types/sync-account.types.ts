// Sync-account wire types and entry mappers.
//
// Attr names verified against vendor/kanidm/libs/client/src/sync_account.rs
// (ATTR_NAME / ATTR_DESCRIPTION imports) and the vendored schema:
// `sync_credential_portal`, `sync_yield_authority`.

import type { KanidmEntry } from '@/shared/types/kanidm';
import { attrFirst, attrList } from '@/shared/types/kanidm';

export interface SyncAccountSummary {
  id: string;
  description: string | null;
}

export interface SyncAccountDetail {
  id: string;
  uuid: string | null;
  description: string | null;
  /** First sync_credential_portal value (URL string), or null. */
  credentialPortal: string | null;
  /** sync_yield_authority values. */
  yieldAttributes: string[];
  raw: KanidmEntry;
}

export function toSyncAccountSummary(entry: KanidmEntry): SyncAccountSummary {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    description: attrFirst(entry, 'description') ?? null,
  };
}

export function toSyncAccountDetail(entry: KanidmEntry): SyncAccountDetail {
  return {
    id: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    uuid: attrFirst(entry, 'uuid') ?? null,
    description: attrFirst(entry, 'description') ?? null,
    credentialPortal: attrFirst(entry, 'sync_credential_portal') ?? null,
    yieldAttributes: attrList(entry, 'sync_yield_authority'),
    raw: entry,
  };
}
