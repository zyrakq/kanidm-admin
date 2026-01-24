import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { themeService } from '../services/theme.service';
import type { Theme } from '../types/theme.types';

/**
 * Theme Toggler Web Component
 *
 * Accessible toggle button for switching between light and dark themes.
 *
 * @example
 * ```typescript
 * import '@/features/theme';
 *
 * // In HTML
 * <theme-toggler></theme-toggler>
 * ```
 */
@customElement('theme-toggler')
export class ThemeToggler extends LitElement {
  @state()
  private theme: Theme = 'light';

  private unsubscribe?: () => void;

  connectedCallback(): void {
    super.connectedCallback();
    this.theme = themeService.getTheme();

    this.unsubscribe = themeService.subscribe((theme) => {
      this.theme = theme;
    });
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  private handleToggle(): void {
    themeService.toggleTheme();
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.handleToggle();
    }
  }

  render() {
    const isDark = this.theme === 'dark';

    return html`
      <button
        class="toggler"
        @click=${this.handleToggle}
        @keydown=${this.handleKeyDown}
        aria-label=${isDark ? 'Switch to light theme' : 'Switch to dark theme'}
        title=${isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      >
        ${!isDark ? this.renderMoonIcon() : this.renderSunIcon()}
      </button>
    `;
  }

  private renderMoonIcon() {
    return html`
      <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    `;
  }

  private renderSunIcon() {
    return html`
      <svg class="icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle
          cx="12"
          cy="12"
          r="5"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="12"
          y1="1"
          x2="12"
          y2="3"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="12"
          y1="21"
          x2="12"
          y2="23"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="4.22"
          y1="4.22"
          x2="5.64"
          y2="5.64"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="18.36"
          y1="18.36"
          x2="19.78"
          y2="19.78"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="1"
          y1="12"
          x2="3"
          y2="12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="21"
          y1="12"
          x2="23"
          y2="12"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="4.22"
          y1="19.78"
          x2="5.64"
          y2="18.36"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
        <line
          x1="18.36"
          y1="5.64"
          x2="19.78"
          y2="4.22"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
        />
      </svg>
    `;
  }

  static styles = css`
    :host {
      display: inline-block;
    }

    .toggler {
      background: transparent;
      border: 1px solid var(--theme-color-border, #e5e7eb);
      border-radius: 6px;
      padding: 0.5rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--theme-color-text-primary, #1f2937);
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease;
      font-family: inherit;
    }

    .toggler:hover {
      background: var(--theme-color-surface, #ffffff);
      border-color: var(--theme-color-text-muted, #9ca3af);
    }

    .toggler:focus-visible {
      outline: 2px solid var(--theme-color-primary, #ff6b35);
      outline-offset: 2px;
    }

    .icon {
      width: 20px;
      height: 20px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'theme-toggler': ThemeToggler;
  }
}
