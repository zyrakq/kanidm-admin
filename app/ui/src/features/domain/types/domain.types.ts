// Domain view model mapped from the Kanidm domain entry. Attr wire
// strings verified against vendor/kanidm/proto/src/constants.rs.

import type { KanidmEntry } from '@/shared/types/kanidm';
import { attrFirst } from '@/shared/types/kanidm';

export interface DomainInfo {
  /** Domain name attr (read-only). */
  name: string;
  uuid: string | null;
  displayName: string | null; // domain_display_name
  ldapBasedn: string | null; // domain_ldap_basedn
  ssid: string | null; // domain_ssid
  allowEasterEggs: boolean; // domain_allow_easter_eggs === 'true'
  allowAccountRecovery: boolean; // domain_allow_account_recovery === 'true'
  raw: KanidmEntry;
}

/** Map the v1 domain entry to the settings view model. */
export function toDomainInfo(entry: KanidmEntry): DomainInfo {
  return {
    name: attrFirst(entry, 'name') ?? attrFirst(entry, 'uuid') ?? '',
    uuid: attrFirst(entry, 'uuid') ?? null,
    displayName: attrFirst(entry, 'domain_display_name') ?? null,
    ldapBasedn: attrFirst(entry, 'domain_ldap_basedn') ?? null,
    ssid: attrFirst(entry, 'domain_ssid') ?? null,
    allowEasterEggs: attrFirst(entry, 'domain_allow_easter_eggs') === 'true',
    allowAccountRecovery:
      attrFirst(entry, 'domain_allow_account_recovery') === 'true',
    raw: entry,
  };
}
