// Shared bulk-delete service + error wording.
//
// The backend endpoint POST /api/bulk-delete fans a batch out into the
// same single DELETE routes the proxy allows, so the whole batch needs
// one step-up prompt instead of one per entry. Each item carries the
// proxy error code; friendlyDeleteFailure() maps the codes callers are
// likely to hit onto localizable strings (source of truth stays the
// Kanidm server).

import { apiFetch } from '@/shared/services/http-client';
import { msg } from '@lit/localize';

export type BulkKind =
  | 'person'
  | 'group'
  | 'service_account'
  | 'oauth2'
  | 'application';

export interface BulkItemResult {
  id: string;
  ok: boolean;
  status: number;
  code?: string;
}

export interface BulkDeleteResponse {
  deleted: number;
  aborted: boolean;
  results: BulkItemResult[];
}

export function bulkDelete(
  kind: BulkKind,
  ids: string[]
): Promise<BulkDeleteResponse> {
  return apiFetch<BulkDeleteResponse>('/api/bulk-delete', {
    method: 'POST',
    body: JSON.stringify({ kind, ids }),
  });
}

/**
 * Localizable failure description for one bulk item result.
 *
 * Kanidm's referential integrity cleans up dangling references after a
 * delete, so most failures are auth-side (denied / protected entry);
 * the common envelope codes map to short strings, anything else falls
 * back to a generic failure line.
 */
export function friendlyDeleteFailure(result: BulkItemResult): string {
  switch (result.code) {
    case 'access_denied':
      return msg('Access denied');
    case 'conflict':
      return msg('The entry is in use and cannot be deleted');
    case 'not_found':
      return msg('Not found');
    case 'kanidm_bad_request':
    case 'kanidm_rejected':
      return msg('The entry is protected and cannot be deleted');
    default:
      return msg('Delete failed');
  }
}
