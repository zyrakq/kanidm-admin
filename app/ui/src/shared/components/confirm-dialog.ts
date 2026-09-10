// Danger confirmation built on modal-dialog: message + confirm button.
// Emits 'confirm' / 'cancel' (in addition to modal-close).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import './modal-dialog';

@customElement('confirm-dialog')
@localized()
export class ConfirmDialog extends LitElement {
  @property({ type: Boolean }) open = false;
  /** Already-localized message shown above the buttons. */
  @property() message = '';
  /** Already-localized confirm button label. */
  @property() confirmLabel = '';
  /** Danger styling for the confirm button (destructive actions). */
  @property({ type: Boolean }) danger = false;
  @property({ type: Boolean }) busy = false;

  private handleModalClose(): void {
    if (!this.busy) {
      this.dispatchEvent(new CustomEvent('cancel', { bubbles: true, composed: true }));
    }
  }

  private handleConfirm(): void {
    this.dispatchEvent(new CustomEvent('confirm', { bubbles: true, composed: true }));
  }

  render() {
    if (!this.open) {
      return nothing;
    }
    return html`
      <modal-dialog
        heading=${msg('Are you sure?')}
        .open=${this.open}
        .busy=${this.busy}
        @modal-close=${this.handleModalClose}
      >
        <p class="message">${this.message}</p>
        <div slot="footer">
          <button
            class="btn btn-secondary"
            type="button"
            ?disabled=${this.busy}
            @click=${this.handleModalClose}
          >
            ${msg('Cancel')}
          </button>
          <button
            class="btn ${this.danger ? 'btn-danger' : 'btn-primary'}"
            type="button"
            ?disabled=${this.busy}
            @click=${this.handleConfirm}
          >
            ${this.busy ? msg('Working...') : this.confirmLabel || msg('Confirm')}
          </button>
        </div>
      </modal-dialog>
    `;
  }

  static styles = css`
    .message {
      margin: 0;
      color: var(--theme-color-text-primary);
      line-height: 1.5;
    }
    .btn {
      border: none;
      border-radius: 6px;
      padding: 8px 16px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-secondary {
      background: var(--theme-color-surface);
      color: var(--theme-color-text-primary);
      border: 1px solid var(--theme-color-border);
    }
    .btn-primary {
      background: var(--theme-color-primary);
      color: #ffffff;
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--theme-color-primary-hover);
    }
    .btn-danger {
      background: var(--theme-color-error);
      color: #ffffff;
    }
    .btn-danger:hover:not(:disabled) {
      filter: brightness(0.9);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'confirm-dialog': ConfirmDialog;
  }
}
