// Self-contained button. Form-associated so type="submit" / "reset" work
// from inside another shadow tree. Clicks on a disabled/loading button
// never reach listeners on the host.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';
import type { IconName } from './ui-icon';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'danger'
  | 'ghost'
  | 'danger-ghost';
export type ButtonSize = 'sm' | 'md';

@customElement('ui-button')
export class UiButton extends LitElement {
  static formAssociated = true;

  @property({ reflect: true }) variant: ButtonVariant = 'secondary';
  @property({ reflect: true }) size: ButtonSize = 'md';
  @property() type: 'button' | 'submit' | 'reset' = 'button';
  @property({ type: Boolean, reflect: true }) disabled = false;
  @property({ type: Boolean, reflect: true }) loading = false;
  @property({ type: Boolean, reflect: true }) block = false;
  @property() icon: IconName | '' = '';
  /** Accessible name for icon-only buttons. */
  @property() label = '';

  private internals = this.attachInternals();

  private handleClick(e: MouseEvent): void {
    if (this.disabled || this.loading) {
      e.stopPropagation();
      return;
    }
    const form = this.internals.form;
    if (!form) return;
    if (this.type === 'submit') form.requestSubmit();
    else if (this.type === 'reset') form.reset();
  }

  render() {
    const inactive = this.disabled || this.loading;
    return html`
      <button
        part="button"
        type="button"
        ?disabled=${inactive}
        aria-busy=${this.loading ? 'true' : 'false'}
        aria-label=${this.label || nothing}
        @click=${this.handleClick}
      >
        ${this.loading
          ? html`<span class="spinner" aria-hidden="true"></span>`
          : this.icon
            ? html`<ui-icon
                name=${this.icon}
                size=${this.size === 'sm' ? 14 : 16}
              ></ui-icon>`
            : nothing}
        <span class="content"><slot></slot></span>
      </button>
    `;
  }

  static styles = css`
    :host {
      display: inline-flex;
      vertical-align: middle;
    }
    :host([block]) {
      display: flex;
      width: 100%;
    }
    :host([disabled]),
    :host([loading]) {
      pointer-events: none;
    }
    button {
      position: relative;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
      padding: 8px 16px;
      border: 1px solid transparent;
      border-radius: var(--theme-radius-md);
      font: inherit;
      font-size: 14px;
      font-weight: 500;
      line-height: 1.25;
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
      transition:
        background-color var(--theme-duration) var(--theme-ease),
        border-color var(--theme-duration) var(--theme-ease),
        color var(--theme-duration) var(--theme-ease),
        box-shadow var(--theme-duration) var(--theme-ease),
        transform var(--theme-duration-fast) var(--theme-ease);
    }
    button:focus-visible {
      outline: none;
      box-shadow: var(--theme-focus-ring);
    }
    button:active:not(:disabled) {
      transform: translateY(1px);
    }
    button:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }
    :host([size='sm']) button {
      padding: 4px 10px;
      font-size: 12px;
      gap: 6px;
      border-radius: var(--theme-radius-sm);
    }

    :host([variant='primary']) button {
      background: var(--theme-color-primary);
      color: var(--theme-color-on-primary);
      box-shadow: var(--theme-primary-glow), var(--theme-highlight);
    }
    :host([variant='primary']) button:hover:not(:disabled) {
      background: var(--theme-color-primary-hover);
    }
    :host([variant='primary']) button:active:not(:disabled) {
      background: var(--theme-color-primary-active);
    }
    :host([variant='primary']) button:focus-visible {
      box-shadow: var(--theme-primary-glow), var(--theme-focus-ring);
    }

    :host([variant='secondary']) button {
      background: var(--theme-color-surface-raised);
      border-color: var(--theme-color-border);
      color: var(--theme-color-text-primary);
      box-shadow: var(--theme-elevation-1), var(--theme-highlight);
    }
    :host([variant='secondary']) button:hover:not(:disabled) {
      background: var(--theme-color-surface-hover);
      border-color: var(--theme-color-border-strong);
    }

    :host([variant='danger']) button {
      background: var(--theme-color-error);
      color: var(--theme-color-on-primary);
      box-shadow: var(--theme-elevation-1), var(--theme-highlight);
    }
    :host([variant='danger']) button:hover:not(:disabled) {
      filter: brightness(0.92);
    }

    :host([variant='ghost']) button {
      background: transparent;
      color: var(--theme-color-text-secondary);
    }
    :host([variant='ghost']) button:hover:not(:disabled) {
      background: var(--theme-color-surface-hover);
      color: var(--theme-color-text-primary);
    }

    :host([variant='danger-ghost']) button {
      background: transparent;
      border-color: color-mix(
        in srgb,
        var(--theme-color-error) 40%,
        transparent
      );
      color: var(--theme-color-error);
    }
    :host([variant='danger-ghost']) button:hover:not(:disabled) {
      background: var(--theme-color-error-soft);
      border-color: var(--theme-color-error);
    }

    .spinner {
      width: 14px;
      height: 14px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.7s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .spinner {
        animation-duration: 2s;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-button': UiButton;
  }
}
