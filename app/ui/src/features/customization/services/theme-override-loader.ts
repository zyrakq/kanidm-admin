// ThemeOverrideLoader — side-effect module.
//
// Injects <link> elements for the theme-light / theme-dark customization
// CSS slots at the END of document.head, AFTER the bundled stylesheet, so
// admin :root overrides win the cascade (Vite always appends its bundle
// link last in the parsed HTML, so static tags in index.html can never
// come after it). Reacts to 'customization-changed' and cache-busts with
// the manifest version.

import { customizationService } from './customization.service';

const THEME_SLOTS = ['theme-light', 'theme-dark'] as const;
type ThemeSlot = (typeof THEME_SLOTS)[number];

function ensureLink(slot: ThemeSlot): HTMLLinkElement {
  const id = `customization-${slot}`;
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    document.head.appendChild(link);
  }
  return link;
}

function applyThemeOverrides(): void {
  const version = customizationService.version();
  for (const slot of THEME_SLOTS) {
    const href = `/customization/${slot}.css?v=${version}`;
    const link = ensureLink(slot);
    if (link.getAttribute('href') !== href) {
      link.setAttribute('href', href);
    }
  }
}

// Register the listener BEFORE init so the init-time event is not missed.
window.addEventListener('customization-changed', applyThemeOverrides);
void customizationService.init().then(applyThemeOverrides);
