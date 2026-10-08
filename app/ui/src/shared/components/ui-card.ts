// Elevated surface container with optional header/footer slots.

import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-card')
export class UiCard extends LitElement {
  /** Hover lift + border emphasis, for clickable/row-like cards. */
  @property({ type: Boolean, reflect: true }) interactive = false;
  /** Sunken (inset) look for nested blocks. */
  @property({ type: Boolean, reflect: true }) sunken = false;
  /** Remove body padding (tables, lists). */
  @property({ type: Boolean, reflect: true }) flush = false;

  render() {
    return html`
      <div class="card">
        <div class="header"><slot name="header"></slot></div>
        <div class="body"><slot></slot></div>
        <div class="footer"><slot name="footer"></slot></div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .card {
      background: var(--theme-color-surface-raised);
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-lg);
      box-shadow: var(--theme-elevation-1), var(--theme-highlight);
      overflow: hidden;
      transition:
        box-shadow var(--theme-duration) var(--theme-ease),
        border-color var(--theme-duration) var(--theme-ease),
        transform var(--theme-duration) var(--theme-ease);
    }
    :host([sunken]) .card {
      background: var(--theme-color-surface-sunken);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.12);
    }
    :host([interactive]) .card:hover {
      border-color: var(--theme-color-border-strong);
      box-shadow: var(--theme-elevation-2), var(--theme-highlight);
      transform: translateY(-1px);
    }
    .body {
      padding: 16px 20px;
    }
    :host([flush]) .body {
      padding: 0;
    }
    .header,
    .footer {
      display: none;
      padding: 12px 20px;
    }
    .header {
      border-bottom: 1px solid var(--theme-color-border);
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .footer {
      border-top: 1px solid var(--theme-color-border);
      justify-content: flex-end;
      gap: 8px;
    }
  `;

  protected firstUpdated(): void {
    for (const name of ['header', 'footer']) {
      const slot = this.renderRoot.querySelector<HTMLSlotElement>(
        `slot[name="${name}"]`
      );
      const wrap = slot?.parentElement;
      if (!slot || !wrap) continue;
      const sync = () => {
        wrap.style.display = slot.assignedNodes().length ? 'flex' : 'none';
      };
      slot.addEventListener('slotchange', sync);
      sync();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-card': UiCard;
  }
}
