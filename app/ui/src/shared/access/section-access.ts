// Section visibility model: which builtin Kanidm groups unlock which
// admin section. UI gating is cosmetic; Kanidm ACPs remain the real
// enforcement (the proxy passes 403s through untouched).

import { msg } from '@lit/localize';

export type SectionId =
  | 'persons'
  | 'groups'
  | 'service-accounts'
  | 'oauth2'
  | 'applications'
  | 'domain'
  | 'system'
  | 'sync'
  | 'recycle-bin'
  | 'messages'
  | 'branding';

export interface SectionDef {
  id: SectionId;
  /** Router path of the section landing page. */
  href: string;
  /** ui-icon registry name. */
  icon: string;
  /** Localized label. */
  label: () => string;
  /** Any of these group names unlocks the section. */
  requiredGroups: string[];
}

export const SECTIONS: SectionDef[] = [
  {
    id: 'persons',
    href: '/admin/persons',
    icon: 'persons',
    label: () => msg('Persons'),
    requiredGroups: ['idm_people_admins'],
  },
  {
    id: 'groups',
    href: '/admin/groups',
    icon: 'groups',
    label: () => msg('Groups'),
    requiredGroups: ['idm_group_admins'],
  },
  {
    id: 'service-accounts',
    href: '/admin/service-accounts',
    icon: 'bot',
    label: () => msg('Service Accounts'),
    requiredGroups: ['idm_service_account_admins'],
  },
  {
    id: 'oauth2',
    href: '/admin/oauth2',
    icon: 'key',
    label: () => msg('OAuth2'),
    requiredGroups: ['idm_oauth2_admins'],
  },
  {
    id: 'applications',
    href: '/admin/applications',
    icon: 'grid',
    label: () => msg('Applications'),
    requiredGroups: ['idm_application_admins'],
  },
  {
    id: 'domain',
    href: '/admin/domain',
    icon: 'globe',
    label: () => msg('Domain'),
    requiredGroups: ['domain_admins'],
  },
  {
    id: 'system',
    href: '/admin/system',
    icon: 'settings',
    label: () => msg('System'),
    requiredGroups: ['idm_account_policy_admins'],
  },
  {
    id: 'sync',
    href: '/admin/sync',
    icon: 'sync',
    label: () => msg('Sync'),
    requiredGroups: ['domain_admins'],
  },
  {
    id: 'recycle-bin',
    href: '/admin/recycle-bin',
    icon: 'trash',
    label: () => msg('Recycle Bin'),
    requiredGroups: ['idm_recycle_bin_admins'],
  },
  {
    id: 'messages',
    href: '/admin/messages',
    icon: 'mail',
    label: () => msg('Messages'),
    requiredGroups: ['idm_message_admins'],
  },
  {
    id: 'branding',
    href: '/admin/branding',
    icon: 'grid',
    label: () => msg('Branding'),
    requiredGroups: ['idm_admins'],
  },
];

/** True when the user's group names unlock the section. */
export function canAccess(groups: string[], section: SectionId): boolean {
  const def = SECTIONS.find((s) => s.id === section);
  if (!def) {
    return false;
  }
  return def.requiredGroups.some((required) => groups.includes(required));
}

/** All sections visible for the given group names, in display order. */
export function visibleSections(groups: string[]): SectionDef[] {
  return SECTIONS.filter((s) => s.requiredGroups.some((r) => groups.includes(r)));
}

/** Path of the first visible section, or null when none are visible. */
export function firstVisiblePath(groups: string[]): string | null {
  return visibleSections(groups)[0]?.href ?? null;
}
