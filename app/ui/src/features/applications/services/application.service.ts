// Application service — SCIM-backed, every call goes through the backend
// proxy (/api/kanidm/*). Endpoints mirror the vendored kanidm client
// (libs/client/src/application.rs); writes are wrapped in withStepUp by
// the calling components. The person application-password fns in the
// vendored file are OUT of scope (YAGNI).

import { apiFetch } from '@/shared/services/http-client';
import type {
  ApplicationDetail,
  ApplicationSummary,
  ScimEntryApplication,
  ScimEntryApplicationPost,
  ScimListApplication,
} from '../types/application.types';
import {
  toApplicationDetail,
  toApplicationSummary,
} from '../types/application.types';

const BASE = '/api/kanidm/scim/v1/Application';

class ApplicationService {
  private static instance: ApplicationService;

  private constructor() {}

  static getInstance(): ApplicationService {
    if (!ApplicationService.instance) {
      ApplicationService.instance = new ApplicationService();
    }
    return ApplicationService.instance;
  }

  /**
   * List all applications (vendor idm_application_list, GET
   * /scim/v1/Application — no query params in v1). Unwraps the camelCase
   * ScimListApplication envelope {totalResults, resources}.
   */
  async list(): Promise<ApplicationSummary[]> {
    const list = await apiFetch<ScimListApplication>(BASE);
    return (list.resources ?? []).map(toApplicationSummary);
  }

  /** Get one application by name or uuid (vendor idm_application_get). */
  async get(id: string): Promise<ApplicationDetail> {
    const entry = await apiFetch<ScimEntryApplication>(
      `${BASE}/${encodeURIComponent(id)}`
    );
    return toApplicationDetail(entry);
  }

  /**
   * Create an application (vendor idm_application_create, POST
   * /scim/v1/Application). Body mirrors ScimEntryApplicationPost:
   * {name, displayname, linked_group: {value: "<group name>"}} — a bare
   * string converts via ScimReference::from and the uuid arm is skipped
   * (skip_serializing_none).
   */
  async create(post: ScimEntryApplicationPost): Promise<ScimEntryApplication> {
    return apiFetch<ScimEntryApplication>(BASE, {
      method: 'POST',
      body: JSON.stringify(post),
    });
  }

  /** Delete (vendor idm_application_delete, DELETE /scim/v1/Application/{id}). */
  async remove(id: string): Promise<void> {
    await apiFetch<void>(`${BASE}/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }
}

export const applicationService = ApplicationService.getInstance();
