// Local avatar URL helper: kanidm persons have no image attribute, so
// avatars are served by our own backend. Shared by the persons feature
// and the session indicator (self avatar).

/** Direct <img>/ui-avatar src for a person avatar. The browser sends
 *  the session cookie; this is NOT an apiFetch call. Append `?v=N`
 *  after mutations to cache-bust. */
export function avatarUrl(id: string): string {
  return `/api/avatar/${encodeURIComponent(id)}`;
}
