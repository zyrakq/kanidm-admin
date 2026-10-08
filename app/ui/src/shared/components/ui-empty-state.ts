// Centered placeholder for empty lists. Heading via attribute, details via
// the default slot, actions via the "action" slot.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-icon';
import type { IconName } from './ui-icon';

@customElement('ui-empty-state')
export class UiEmptyState extends LitElement {
  @property() icon: IconName | '' = '';
  @property() heading = '';

  render() {
    return html`
      <div class="wrap">
        ${this.icon
          ? html`<div class="icon">
              <ui-icon name=${this.icon} size="22"></ui-icon>
            </div>`
          : nothing}
        ${this.heading ? html`<p class="heading">${this.heading}</p>` : nothing}
        <p class="text"><slot></slot></p>
        <slot name="action"></slot>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      padding: 32px 16px;
      text-align: center;
      border: 1px dashed var(--theme-color-border);
      border-radius: var(--theme-radius-lg);
      background: var(--theme-color-surface-sunken);
    }
    .icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      color: var(--theme-color-text-muted);
      background: var(--theme-color-surface-raised);
      box-shadow: var(--theme-elevation-1), var(--theme-highlight);
    }
    .heading {
      margin: 0;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .text {
      margin: 0;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    .text:empty {
      display: none;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-empty-state': UiEmptyState;
  }
}
