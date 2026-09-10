// Thin fetch wrapper for the same-origin /api backend.
//
// Normalizes every error to the backend JSON convention
// { error: { code, message } } and signals session expiry to the auth
// feature via the 'auth-session-expired' CustomEvent (same window-event
// signaling pattern as 'notification-add').

export type ApiErrorCode =
  | 'invalid_credentials'
  | 'session_expired'
  | 'reauth_required'
  | 'kanidm_unreachable'
  | 'validation_error'
  | 'access_denied'
  | 'not_found'
  | 'conflict'
  | 'kanidm_bad_request'
  | 'kanidm_rejected'
  | 'kanidm_error';

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
  }
}

export interface ApiFetchOptions extends RequestInit {
  /**
   * Do not dispatch 'auth-session-expired' on a 401. Used by the session
   * bootstrap call, where a 401 simply means "not authenticated" and must
   * not trigger a redirect loop on the welcome page.
   */
  readonly ignoreSessionExpired?: boolean;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export async function apiFetch<T>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { ignoreSessionExpired, ...init } = options;

  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  // FormData bodies must keep their browser-generated multipart
  // Content-Type (boundary included); never force JSON on them.
  if (
    init.body !== undefined &&
    !(init.body instanceof FormData) &&
    !headers.has('Content-Type')
  ) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(path, {
      credentials: 'same-origin',
      ...init,
      headers,
    });
  } catch {
    throw new ApiError(
      'kanidm_unreachable',
      'Network request failed.',
      0
    );
  }

  if (!response.ok) {
    throw await toApiError(response, ignoreSessionExpired ?? false);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function toApiError(
  response: Response,
  ignoreSessionExpired: boolean
): Promise<ApiError> {
  let code: ApiErrorCode = 'kanidm_unreachable';
  let message = `Request failed with status ${response.status}.`;

  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.code) {
      code = body.error.code as ApiErrorCode;
    }
    if (body.error?.message) {
      message = body.error.message;
    }
  } catch {
    // Non-JSON error body: keep the fallback code and message.
  }

  if (
    !ignoreSessionExpired &&
    response.status === 401 &&
    code === 'session_expired'
  ) {
    window.dispatchEvent(
      new CustomEvent('auth-session-expired', {
        bubbles: true,
        composed: true,
      })
    );
  }

  return new ApiError(code, message, response.status);
}
