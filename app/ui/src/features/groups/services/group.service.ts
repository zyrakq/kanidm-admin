// Group service — every call goes through the backend proxy
// (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/group.rs + lib.rs group section); writes are wrapped
// in withStepUp by the calling components.

import { apiFetch } from '@/shared/services/http-client';
import { entryBody, type KanidmEntry } from '@/shared/types/kanidm';
import type { GroupDetail, GroupSummary } from '../types/group.types';
import { toGroupDetail, toGroupSummary } from '../types/group.types';

const BASE = '/api/kanidm/v1';

class GroupService {
  private static instance: GroupService;

  private constructor() {}

  static getInstance(): GroupService {
    if (!GroupService.instance) {
      GroupService.instance = new GroupService();
    }
    return GroupService.instance;
  }

  /** List all groups (GET /v1/group, vendor idm_group_list). */
  async list(): Promise<GroupSummary[]> {
    const entries = await apiFetch<KanidmEntry[]>(`${BASE}/group`);
    return entries.map(toGroupSummary);
  }

  /** Get one group by name or uuid (vendor idm_group_get). */
  async get(id: string): Promise<GroupDetail> {
    const entry = await apiFetch<KanidmEntry>(`${BASE}/group/${encodeURIComponent(id)}`);
    return toGroupDetail(entry);
  }

  /** Create (vendor idm_group_create: POST /v1/group, attrs name). */
  async create(id: string, displayName?: string): Promise<void> {
    const attrs: Record<string, string[]> = { name: [id] };
    if (displayName !== undefined) {
      attrs.displayname = [displayName];
    }
    await apiFetch<void>(`${BASE}/group`, {
      method: 'POST',
      body: JSON.stringify(entryBody(attrs)),
    });
  }

  /** Rename (vendor group_rename: PUT /v1/group/{id}/_attr/name). */
  async rename(id: string, newName: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/name`,
      { method: 'PUT', body: JSON.stringify([newName]) }
    );
  }

  /** Set displayname (generic attr path; ATTR_DISPLAYNAME). */
  async setDisplayName(id: string, displayName: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/displayname`,
      { method: 'PUT', body: JSON.stringify([displayName]) }
    );
  }

  /** Purge description (vendor idm_group_purge_description). */
  async purgeDescription(id: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/description`,
      { method: 'DELETE' }
    );
  }

  /** Set description (vendor idm_group_set_description). */
  async setDescription(id: string, description: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/description`,
      { method: 'PUT', body: JSON.stringify([description]) }
    );
  }

  /** Delete (vendor idm_group_delete: DELETE /v1/group/{id}). */
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/group/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  /** Replace members (vendor idm_group_set_members: PUT _attr/member). */
  async setMembers(id: string, members: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/member`,
      { method: 'PUT', body: JSON.stringify(members) }
    );
  }

  /** Append members (vendor idm_group_add_members: POST _attr/member). */
  async addMembers(id: string, members: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/member`,
      { method: 'POST', body: JSON.stringify(members) }
    );
  }

  /**
   * Remove members (vendor idm_group_remove_members: DELETE
   * _attr/member WITH a JSON body, as the vendored client does via
   * perform_delete_request_with_body).
   */
  async removeMembers(id: string, members: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/member`,
      { method: 'DELETE', body: JSON.stringify(members) }
    );
  }

  /** Set mail (vendor idm_group_set_mail: PUT _attr/mail). */
  async setMail(id: string, mail: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/mail`,
      { method: 'PUT', body: JSON.stringify(mail) }
    );
  }

  /** Purge any attribute (vendor idm_group_purge_attr). */
  async purgeAttr(id: string, attr: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/${encodeURIComponent(attr)}`,
      { method: 'DELETE' }
    );
  }

  /**
   * POSIX extend (vendor idm_group_unix_extend: POST /v1/group/{id}/_unix
   * with GroupUnixExtend { gidnumber: Option<u32> }; the struct has no
   * skip_serializing_none, so None serializes as null).
   */
  async unixExtend(id: string, gidnumber?: number): Promise<void> {
    await apiFetch<void>(`${BASE}/group/${encodeURIComponent(id)}/_unix`, {
      method: 'POST',
      body: JSON.stringify({ gidnumber: gidnumber ?? null }),
    });
  }

  /** POSIX token (vendor idm_group_unix_token_get -> UnixGroupToken). */
  async unixToken(id: string): Promise<{
    name: string;
    spn: string;
    uuid: string;
    gidnumber: number;
  }> {
    return apiFetch(`${BASE}/group/${encodeURIComponent(id)}/_unix/_token`);
  }

  /**
   * Enable account policy (vendor group_account_policy_enable: POST
   * _attr/class with ["account_policy"]; same call the CLI's
   * `group account-policy enable` makes).
   */
  async enableAccountPolicy(id: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/class`,
      { method: 'POST', body: JSON.stringify(['account_policy']) }
    );
  }

  /**
   * Disable account policy: DELETE _attr/class with body
   * ["account_policy"]. No dedicated vendored function exists (the CLI
   * only has enable); the DELETE-with-body transport is the same one
   * idm_group_remove_members uses (perform_delete_request_with_body).
   */
  async disableAccountPolicy(id: string): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/class`,
      { method: 'DELETE', body: JSON.stringify(['account_policy']) }
    );
  }

  /**
   * Generic account-policy attribute write (PUT _attr/{attr}). Use the
   * ACCOUNT_POLICY_ATTRS wire names from group.types.ts — the server
   * matches the exact snake_case ATTR_* constants.
   */
  async setPolicyAttr(id: string, attr: string, values: string[]): Promise<void> {
    await apiFetch<void>(
      `${BASE}/group/${encodeURIComponent(id)}/_attr/${encodeURIComponent(attr)}`,
      { method: 'PUT', body: JSON.stringify(values) }
    );
  }
}

export const groupService = GroupService.getInstance();
