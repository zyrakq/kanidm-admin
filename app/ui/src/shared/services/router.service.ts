// Navigation service: lets any component navigate within the SPA through
// the Router instance owned by <app-component>, instead of triggering a
// full page reload with window.location.assign().

import type { Router } from '@lit-labs/router';

let router: Router | undefined;

/** Register the app Router. Called once by <app-component>. */
export function registerRouter(instance: Router): void {
  router = instance ?? undefined;
}

/** Navigate within the SPA. Reloads the page only if no router is registered. */
export function navigate(path: string): void {
  if (router !== undefined) {
    void router.goto(path);
  } else {
    window.location.assign(path);
  }
}
