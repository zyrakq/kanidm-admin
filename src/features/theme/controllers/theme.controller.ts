import { type ReactiveController, type ReactiveControllerHost } from 'lit';
import { themeService } from '../services/theme.service';
import type { Theme } from '../types/theme.types';

/**
 * Lit Reactive Controller for theme-aware components
 *
 * Automatically syncs component with global theme state.
 * Modern alternative to class mixins.
 *
 * @example
 * ```typescript
 * import { LitElement, html } from 'lit';
 * import { customElement } from 'lit/decorators.js';
 * import { ThemeController } from '@/features/theme';
 *
 * customElements.define('my-component', class extends LitElement {
 *   private theme = new ThemeController(this);
 *
 *   render() {
 *     return html`
 *       <div class="card">
 *         Current theme: ${this.theme.theme}
 *       </div>
 *     `;
 *   }
 * });
 * ```
 */
export class ThemeController implements ReactiveController {
  private host: ReactiveControllerHost;
  private unsubscribe?: () => void;

  /**
   * Current theme value
   * Use this in your component's render method
   */
  theme: Theme;

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    this.theme = themeService.getTheme();
    host.addController(this);
  }

  /**
   * Called when the host element is connected to the DOM
   */
  hostConnected(): void {
    // Subscribe to theme changes
    this.unsubscribe = themeService.subscribe((theme) => {
      this.theme = theme;
      this.host.requestUpdate();
    });
  }

  /**
   * Called when the host element is disconnected from the DOM
   */
  hostDisconnected(): void {
    // Clean up subscription
    this.unsubscribe?.();
    this.unsubscribe = undefined;
  }
}
