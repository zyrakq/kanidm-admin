// Danger confirmation built on modal-dialog: message + confirm button.
// Emits 'confirm' / 'cancel' (in addition to modal-close).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import './modal-dialog';
import './ui-button';

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
      this.dispatchEvent(
        new CustomEvent('cancel', { bubbles: true, composed: true })
      );
    }
  }

  private handleConfirm(): void {
    this.dispatchEvent(
      new CustomEvent('confirm', { bubbles: true, composed: true })
    );
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
          <ui-button ?disabled=${this.busy} @click=${this.handleModalClose}>
            ${msg('Cancel')}
          </ui-button>
          <ui-button
            variant=${this.danger ? 'danger' : 'primary'}
            ?loading=${this.busy}
            @click=${this.handleConfirm}
          >
            ${this.busy
              ? msg('Working...')
              : this.confirmLabel || msg('Confirm')}
          </ui-button>
        </div>
      </modal-dialog>
    `;
  }

  static styles = css`
    [slot='footer'] {
      display: flex;
      gap: 8px;
    }
    .message {
      margin: 0;
      color: var(--theme-color-text-primary);
      line-height: 1.5;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'confirm-dialog': ConfirmDialog;
  }
}
