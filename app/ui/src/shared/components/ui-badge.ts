// Small status pill.

import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'error'
  | 'warning'
  | 'info';

@customElement('ui-badge')
export class UiBadge extends LitElement {
  @property({ reflect: true }) variant: BadgeVariant = 'neutral';

  render() {
    return html`<span class="badge"><slot></slot></span>`;
  }

  static styles = css`
    :host {
      display: inline-flex;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 999px;
      border: 1px solid color-mix(in srgb, var(--badge-color) 28%, transparent);
      background: var(--badge-bg);
      color: var(--badge-color);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.5;
      white-space: nowrap;
    }
    :host,
    :host([variant='neutral']) {
      --badge-color: var(--theme-color-text-secondary);
      --badge-bg: var(--theme-color-surface-sunken);
    }
    :host([variant='primary']) {
      --badge-color: var(--theme-color-primary);
      --badge-bg: var(--theme-color-primary-soft);
    }
    :host([variant='success']) {
      --badge-color: var(--theme-color-success);
      --badge-bg: var(--theme-color-success-soft);
    }
    :host([variant='error']) {
      --badge-color: var(--theme-color-error);
      --badge-bg: var(--theme-color-error-soft);
    }
    :host([variant='warning']) {
      --badge-color: var(--theme-color-warning);
      --badge-bg: var(--theme-color-warning-soft);
    }
    :host([variant='info']) {
      --badge-color: var(--theme-color-info);
      --badge-bg: var(--theme-color-info-soft);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-badge': UiBadge;
  }
}
