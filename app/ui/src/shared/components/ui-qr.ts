// Collapsible QR tile. Always black-on-white for scanner contrast, so the
// tile backdrop is intentionally not themed. Emits 'copy' for the image.

import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import './ui-button';

@customElement('ui-qr')
export class UiQr extends LitElement {
  /** Image src (data URL). */
  @property() src = '';
  @property() alt = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Already-localized label of the copy button. */
  @property({ attribute: 'copy-label' }) copyLabel = '';

  private handleCopy(): void {
    this.dispatchEvent(new CustomEvent('copy', { bubbles: true, composed: true }));
  }

  render() {
    return html`
      <div class="collapse" aria-hidden=${this.open ? 'false' : 'true'} ?inert=${!this.open}>
        <div class="inner">
          <div class="panel">
            <div class="tile">
              <img class="img" src=${this.src} alt=${this.alt} />
            </div>
            <ui-button icon="copy" @click=${this.handleCopy}>${this.copyLabel}</ui-button>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .collapse {
      display: grid;
      grid-template-rows: 0fr;
      opacity: 0;
      transition:
        grid-template-rows 0.28s var(--theme-ease),
        opacity 0.2s var(--theme-ease);
    }
    :host([open]) .collapse {
      grid-template-rows: 1fr;
      opacity: 1;
    }
    .inner {
      overflow: hidden;
      min-height: 0;
    }
    .panel {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 16px;
      background: var(--theme-color-surface-sunken);
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-lg);
    }
    .tile {
      padding: 12px;
      background: #ffffff;
      border-radius: var(--theme-radius-lg);
      box-shadow: var(--theme-elevation-2);
    }
    .img {
      display: block;
      width: 10rem;
      height: 10rem;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-qr': UiQr;
  }
}
