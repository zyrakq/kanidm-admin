import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationModalStyles } from './notification-modal.styles';
import type { NotificationType } from '../types/notification.types.ts';

@customElement('notification-modal')
@localized()
export class NotificationModal extends LitElement {
  @property({ type: String }) message = '';
  @property({ type: String }) type: NotificationType = 'info';
  @state() private isOpen = false;

  open() {
    this.isOpen = true;
    document.body.style.overflow = 'hidden';

    // Pause all notification timers when modal opens
    window.dispatchEvent(
      new CustomEvent('modal-opened', {
        bubbles: true,
        composed: true,
      })
    );
  }

  close() {
    this.isOpen = false;
    document.body.style.overflow = '';

    // Resume all notification timers when modal closes
    window.dispatchEvent(
      new CustomEvent('modal-closed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleOverlayClick(e: MouseEvent) {
    if (e.target === e.currentTarget) {
      this.close();
    }
  }

  private handleClose(e: Event) {
    e.stopPropagation();
    e.preventDefault();
    this.close();
  }

  private handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape' && this.isOpen) {
      this.close();
    }
  }

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('keydown', this.handleKeyDown.bind(this));
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this.handleKeyDown.bind(this));
    document.body.style.overflow = '';
  }

  private getTypeLabel() {
    switch (this.type) {
      case 'success':
        return msg('Success');
      case 'error':
        return msg('Error');
      case 'warning':
        return msg('Warning');
      case 'info':
        return msg('Info');
      default:
        return msg('Notification');
    }
  }

  private getIcon() {
    switch (this.type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
        return 'ℹ';
      default:
        return 'ℹ';
    }
  }

  render() {
    if (!this.isOpen) return html``;

    return html`
      <div class="modal-overlay" @click=${this.handleOverlayClick}>
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-title">
              <div class="modal-icon modal-icon-${this.type}">
                ${this.getIcon()}
              </div>
              <span class="modal-title-text">${this.getTypeLabel()}</span>
            </div>
            <button
              class="modal-close"
              @click=${(e: Event) => this.handleClose(e)}
              aria-label=${msg('Close modal')}
            >
              ✕
            </button>
          </div>
          <div class="modal-content">
            <p class="modal-message">${this.message}</p>
          </div>
        </div>
      </div>
    `;
  }

  static styles = notificationModalStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'notification-modal': NotificationModal;
  }
}
