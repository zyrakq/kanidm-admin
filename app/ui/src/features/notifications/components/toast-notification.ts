import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { toastNotificationStyles } from './toast-notification.styles';
import type { NotificationType } from '../types/notification.types.ts';

@customElement('toast-notification')
@localized()
export class ToastNotification extends LitElement {
  @property({ type: String }) message = '';
  @property({ type: String }) type: NotificationType = 'info';
  @property({ type: String, reflect: true }) notificationId = '';

  private readonly MAX_LENGTH = 150;

  private handleClose(e: Event) {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent('toast-close', {
        detail: this.notificationId,
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleMouseEnter() {
    this.dispatchEvent(
      new CustomEvent('toast-pause', {
        detail: this.notificationId,
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleMouseLeave() {
    this.dispatchEvent(
      new CustomEvent('toast-resume', {
        detail: this.notificationId,
        bubbles: true,
        composed: true,
      })
    );
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

  private isLongMessage(): boolean {
    return this.message.length > this.MAX_LENGTH;
  }

  private handleToastClick(e: Event) {
    if (this.isLongMessage()) {
      e.stopPropagation();

      // Dispatch event to toast-container to open modal
      window.dispatchEvent(
        new CustomEvent('open-notification-modal', {
          detail: {
            message: this.message,
            type: this.type,
          },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  render() {
    const isLong = this.isLongMessage();
    return html`
      <div
        class="toast toast-${this.type} ${isLong ? 'toast-clickable' : ''}"
        @mouseenter=${this.handleMouseEnter}
        @mouseleave=${this.handleMouseLeave}
        @click=${this.handleToastClick}
      >
        <div class="toast-icon">${this.getIcon()}</div>
        <div class="toast-message ${isLong ? 'toast-message-truncated' : ''}">
          ${this.message}
        </div>
        <button
          class="toast-close"
          @click=${this.handleClose}
          aria-label=${msg('Close notification')}
        >
          ✕
        </button>
      </div>
    `;
  }

  static styles = toastNotificationStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-notification': ToastNotification;
  }
}
