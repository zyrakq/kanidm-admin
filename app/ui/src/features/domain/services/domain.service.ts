// Domain service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/lib.rs + domain.rs); writes are wrapped in
// withStepUp by the calling component (D8).

import { apiFetch } from '@/shared/services/http-client';
import type { KanidmEntry } from '@/shared/types/kanidm';
import type { DomainInfo } from '../types/domain.types';
import { toDomainInfo } from '../types/domain.types';

const BASE = '/api/kanidm/v1';

class DomainService {
  private static instance: DomainService;

  private constructor() {}

  static getInstance(): DomainService {
    if (!DomainService.instance) {
      DomainService.instance = new DomainService();
    }
    return DomainService.instance;
  }

  /** Get the domain entry (vendor idm_domain_get, GET /v1/domain). */
  async get(): Promise<DomainInfo> {
    const entries = await apiFetch<KanidmEntry[]>(`${BASE}/domain`);
    const entry = entries[0];
    if (!entry) {
      throw new Error('Domain entry missing from response.');
    }
    return toDomainInfo(entry);
  }

  /** Set display name (vendor idm_domain_set_display_name). */
  async setDisplayName(name: string): Promise<void> {
    await apiFetch<void>(`${BASE}/domain/_attr/domain_display_name`, {
      method: 'PUT',
      body: JSON.stringify([name]),
    });
  }

  /** Set LDAP base DN (vendor idm_domain_set_ldap_basedn). */
  async setLdapBasedn(basedn: string): Promise<void> {
    await apiFetch<void>(`${BASE}/domain/_attr/domain_ldap_basedn`, {
      method: 'PUT',
      body: JSON.stringify([basedn]),
    });
  }

  /** Set wireless SSID (vendor idm_domain_set_ssid). */
  async setSsid(ssid: string): Promise<void> {
    await apiFetch<void>(`${BASE}/domain/_attr/domain_ssid`, {
      method: 'PUT',
      body: JSON.stringify([ssid]),
    });
  }

  /** Toggle easter eggs (vendor idm_set_domain_allow_easter_eggs). */
  async setAllowEasterEggs(allow: boolean): Promise<void> {
    await apiFetch<void>(`${BASE}/domain/_attr/domain_allow_easter_eggs`, {
      method: 'PUT',
      body: JSON.stringify([allow ? 'true' : 'false']),
    });
  }

  /** Toggle account recovery (vendor idm_set_domain_allow_account_recovery). */
  async setAllowAccountRecovery(allow: boolean): Promise<void> {
    await apiFetch<void>(
      `${BASE}/domain/_attr/domain_allow_account_recovery`,
      {
        method: 'PUT',
        body: JSON.stringify([allow ? 'true' : 'false']),
      }
    );
  }

  /** Set max queryable LDAP attrs (vendor idm_domain_set_ldap_max_queryable_attrs). */
  async setLdapMaxQueryableAttrs(count: number): Promise<void> {
    await apiFetch<void>(`${BASE}/domain/_attr/ldap_max_queryable_attrs`, {
      method: 'PUT',
      body: JSON.stringify([String(count)]),
    });
  }

  /** Toggle LDAP unix password bind (vendor idm_set_ldap_allow_unix_password_bind). */
  async setAllowUnixPwBind(allow: boolean): Promise<void> {
    await apiFetch<void>(`${BASE}/domain/_attr/ldap_allow_unix_pw_bind`, {
      method: 'PUT',
      body: JSON.stringify([allow ? 'true' : 'false']),
    });
  }

  /**
   * The account-policy minimum credential type enforced on all persons
   * (vendor idm_all_persons credential_type_minimum). Read from the
   * group entry; null = attr unset = policy 'any' (server default).
   */
  async getCredentialTypeMinimum(): Promise<
    'any' | 'mfa' | 'passkey' | 'attested_passkey' | null
  > {
    const entries = await apiFetch<KanidmEntry[]>(
      `${BASE}/group/idm_all_persons`
    );
    const value = entries[0]?.attrs['credential_type_minimum']?.[0];
    if (
      value === 'any' ||
      value === 'mfa' ||
      value === 'passkey' ||
      value === 'attested_passkey'
    ) {
      return value;
    }
    return null;
  }

  /**
   * Set the minimum credential type on idm_all_persons (vendor
   * group_account_policy_credential_type_minimum_set: PUT
   * /v1/group/{id}/_attr/credential_type_minimum).
   */
  async setCredentialTypeMinimum(
    value: 'any' | 'mfa' | 'passkey' | 'attested_passkey'
  ): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/idm_all_persons/_attr/credential_type_minimum`,
      {
        method: 'PUT',
        body: JSON.stringify([value]),
      }
    );
  }

  /**
   * Upload the domain image (vendor idm_domain_update_image: POST
   * /v1/domain/_image multipart with a part named "image"). The FormData
   * keeps the browser-generated multipart boundary (http-client never
   * forces JSON Content-Type on FormData bodies).
   */
  async setImage(file: File): Promise<void> {
    const form = new FormData();
    form.append('image', file);
    await apiFetch<void>(`${BASE}/domain/_image`, {
      method: 'POST',
      body: form,
    });
  }

  /** Remove the domain image (vendor idm_domain_delete_image). */
  async removeImage(): Promise<void> {
    await apiFetch<void>(`${BASE}/domain/_image`, { method: 'DELETE' });
  }
}

export const domainService = DomainService.getInstance();
