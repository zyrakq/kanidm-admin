// Navigation service: lets any component navigate within the SPA through
// the Router instance owned by <app-component>, instead of triggering a
// full page reload with window.location.assign().

import type { Router } from '@lit-labs/router';

let router: Router | undefined;

/** Register the app Router. Called once by <app-component>. */
export function registerRouter(instance: Router): void {
  router = instance ?? undefined;
}

/**
 * Navigate within the SPA. Reloads the page only if no router is
 * registered.
 *
 * `@lit-labs/router`'s `goto()` never touches `history` — only its global
 * anchor-click interceptor does. To keep programmatic navigation on par
 * with anchor clicks, update the history entry first (push, or replace
 * for redirects), then hand off to the router. Pass `{ replace: true }`
 * for redirects (guards, legacy bookmarks) so they do not pollute the
 * history stack.
 */
export function navigate(path: string, opts?: { replace?: boolean }): void {
  if (router !== undefined) {
    if (opts?.replace) {
      history.replaceState({}, '', path);
    } else {
      history.pushState({}, '', path);
    }
    void router.goto(path);
  } else {
    window.location.assign(path);
  }
}
