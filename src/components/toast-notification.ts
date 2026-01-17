import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { NotificationType } from '@/types/notification.types.ts';

@customElement('toast-notification')
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
          aria-label="Close notification"
        >
          ✕
        </button>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }

    :host(.removing) {
      animation: slideOut 0.3s ease-in forwards;
    }

    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(100%);
        opacity: 0;
      }
    }

    .toast {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 1rem;
      background: white;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      min-width: 320px;
      max-width: 420px;
      border-left: 4px solid;
      opacity: var(--toast-opacity, 1);
      transition: opacity 0.05s linear;
    }

    .toast-success {
      border-left-color: #10b981;
    }

    .toast-error {
      border-left-color: #ef4444;
    }

    .toast-warning {
      border-left-color: #f59e0b;
    }

    .toast-info {
      border-left-color: #3b82f6;
    }

    .toast-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      font-size: 14px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .toast-success .toast-icon {
      background: #d1fae5;
      color: #10b981;
    }

    .toast-error .toast-icon {
      background: #fee2e2;
      color: #ef4444;
    }

    .toast-warning .toast-icon {
      background: #fef3c7;
      color: #f59e0b;
    }

    .toast-info .toast-icon {
      background: #dbeafe;
      color: #3b82f6;
    }

    .toast-message {
      flex: 1;
      color: #1f2937;
      font-size: 0.875rem;
      font-weight: 500;
      line-height: 1.4;
    }

    .toast-message-truncated {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      position: relative;
      max-height: 4.2rem;
    }

    .toast-message-truncated::after {
      content: '';
      position: absolute;
      bottom: 0;
      right: 0;
      width: 100%;
      height: 1.4rem;
      background: linear-gradient(
        to bottom,
        rgba(255, 255, 255, 0),
        rgba(255, 255, 255, 1)
      );
      pointer-events: none;
    }

    .toast-clickable {
      cursor: pointer;
      transition:
        transform 0.2s ease,
        box-shadow 0.2s ease;
    }

    .toast-clickable:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
    }

    .toast-clickable:active {
      transform: translateY(0);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }

    .toast-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 20px;
      height: 20px;
      padding: 0;
      border: none;
      background: transparent;
      color: #6b7280;
      font-size: 16px;
      cursor: pointer;
      flex-shrink: 0;
      transition: color 0.2s ease;
    }

    .toast-close:hover {
      color: #1f2937;
    }

    .toast-close:focus {
      outline: 2px solid #ff6b35;
      outline-offset: 2px;
      border-radius: 2px;
    }

    @media (max-width: 640px) {
      .toast {
        min-width: 280px;
        max-width: calc(100vw - 32px);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-notification': ToastNotification;
  }
}
