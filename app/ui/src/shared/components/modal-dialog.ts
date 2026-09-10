// Generic modal overlay. Based on the reauth-modal pattern: Escape key,
// overlay click, body scroll lock. Content and footer are slots so any
// feature can host forms or confirm buttons inside.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import './ui-icon';

@customElement('modal-dialog')
@localized()
export class ModalDialog extends LitElement {
  /** Dialog title (already-localized string from the caller). */
  @property() heading = '';
  @property({ type: Boolean, reflect: true }) open = false;
  /** Blocks overlay-click and Escape closing while true. */
  @property({ type: Boolean }) busy = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeyDown);
    document.body.style.overflow = '';
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('open')) {
      document.body.style.overflow = this.open ? 'hidden' : '';
    }
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.open && !this.busy) {
      this.requestClose('escape');
    }
  };

  private handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget && !this.busy) {
      this.requestClose('overlay');
    }
  }

  private requestClose(source: 'escape' | 'overlay' | 'button'): void {
    this.dispatchEvent(
      new CustomEvent('modal-close', {
        detail: { source },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    if (!this.open) {
      return nothing;
    }
    return html`
      <div class="overlay" @click=${this.handleOverlayClick} role="presentation">
        <div class="card" role="dialog" aria-modal="true" aria-label=${this.heading}>
          <div class="card-header">
            <span class="card-title">${this.heading}</span>
            <button
              class="icon-btn"
              type="button"
              ?disabled=${this.busy}
              @click=${() => this.requestClose('button')}
              aria-label=${msg('Close')}
            >
              <ui-icon name="x" size="16"></ui-icon>
            </button>
          </div>
          <div class="card-content">
            <slot></slot>
          </div>
          <div class="card-footer">
            <slot name="footer"></slot>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    .overlay {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .card {
      background: var(--theme-color-surface-elevated);
      border-radius: 8px;
      box-shadow: var(--theme-shadow-lg);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      border-bottom: 1px solid var(--theme-color-border);
    }
    .card-title {
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .icon-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      color: var(--theme-color-text-secondary);
      cursor: pointer;
      padding: 4px;
      border-radius: 4px;
    }
    .icon-btn:hover {
      color: var(--theme-color-text-primary);
      background: var(--theme-color-border);
    }
    .card-content {
      padding: 20px;
      overflow-y: auto;
    }
    .card-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--theme-color-border);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'modal-dialog': ModalDialog;
  }
}
