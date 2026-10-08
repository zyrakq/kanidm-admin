// Generic modal overlay. Based on the reauth-modal pattern: Escape key,
// overlay click, body scroll lock. Content and footer are slots so any
// feature can host forms or confirm buttons inside.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
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

  @state() private hasFooter = false;

  private handleFooterSlot(e: Event): void {
    this.hasFooter = (e.target as HTMLSlotElement).assignedNodes().length > 0;
  }

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
      <div
        class="overlay"
        @click=${this.handleOverlayClick}
        role="presentation"
      >
        <div
          class="card"
          role="dialog"
          aria-modal="true"
          aria-label=${this.heading}
        >
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
          <div class="card-footer" ?hidden=${!this.hasFooter}>
            <slot name="footer" @slotchange=${this.handleFooterSlot}></slot>
          </div>
        </div>
      </div>
    `;
  }

  static styles = css`
    .overlay {
      position: fixed;
      inset: 0;
      background: var(--theme-overlay-bg);
      backdrop-filter: blur(var(--theme-overlay-blur));
      -webkit-backdrop-filter: blur(var(--theme-overlay-blur));
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
      animation: overlay-in var(--theme-duration) var(--theme-ease);
    }
    .card {
      box-sizing: border-box;
      background: var(--theme-color-surface-elevated);
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-xl);
      box-shadow: var(--theme-elevation-3), var(--theme-highlight);
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      animation: card-in 0.22s var(--theme-ease);
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
      font-size: 16px;
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
      padding: 6px;
      border-radius: var(--theme-radius-sm);
      transition:
        background-color var(--theme-duration) var(--theme-ease),
        color var(--theme-duration) var(--theme-ease);
    }
    .icon-btn:hover:not(:disabled) {
      color: var(--theme-color-text-primary);
      background: var(--theme-color-surface-hover);
    }
    .icon-btn:focus-visible {
      outline: none;
      box-shadow: var(--theme-focus-ring);
    }
    .icon-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .card-content {
      padding: 20px;
      overflow-y: auto;
    }
    .card-footer[hidden] {
      display: none;
    }
    .card-footer {
      padding: 12px 20px;
      border-top: 1px solid var(--theme-color-border);
      background: var(--theme-color-surface-sunken);
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    @keyframes overlay-in {
      from {
        opacity: 0;
      }
    }
    @keyframes card-in {
      from {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
      }
    }
    @media (max-width: 640px) {
      .overlay {
        padding: 16px;
      }
      .card {
        max-width: calc(100% - 32px);
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .overlay,
      .card {
        animation: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'modal-dialog': ModalDialog;
  }
}
