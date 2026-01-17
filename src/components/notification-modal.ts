import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { NotificationType } from '@/types/notification.types.ts';

@customElement('notification-modal')
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
        return 'Success';
      case 'error':
        return 'Error';
      case 'warning':
        return 'Warning';
      case 'info':
        return 'Info';
      default:
        return 'Notification';
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
              aria-label="Close modal"
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

  static styles = css`
    :host {
      display: block;
    }

    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      padding: 1rem;
      animation: fadeIn 0.2s ease-out;
      pointer-events: auto;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
      }
      to {
        opacity: 1;
      }
    }

    .modal-card {
      background: #ffffff;
      border-radius: 8px;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
      max-width: 600px;
      width: 100%;
      max-height: 80vh;
      display: flex;
      flex-direction: column;
      animation: slideUp 0.3s ease-out;
    }

    @keyframes slideUp {
      from {
        transform: translateY(20px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1.25rem 1.5rem;
      border-bottom: 1px solid #e5e7eb;
    }

    .modal-title {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .modal-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 16px;
      font-weight: 600;
      flex-shrink: 0;
    }

    .modal-icon-success {
      background: #d1fae5;
      color: #10b981;
    }

    .modal-icon-error {
      background: #fee2e2;
      color: #ef4444;
    }

    .modal-icon-warning {
      background: #fef3c7;
      color: #f59e0b;
    }

    .modal-icon-info {
      background: #dbeafe;
      color: #3b82f6;
    }

    .modal-title-text {
      font-size: 1.125rem;
      font-weight: 600;
      color: #1f2937;
    }

    .modal-close {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: none;
      background: transparent;
      color: #6b7280;
      font-size: 20px;
      cursor: pointer;
      border-radius: 6px;
      transition: all 0.2s ease;
    }

    .modal-close:hover {
      background: #f3f4f6;
      color: #1f2937;
    }

    .modal-close:focus {
      outline: 2px solid #ff6b35;
      outline-offset: 2px;
    }

    .modal-content {
      padding: 1.5rem;
      overflow-y: auto;
      flex: 1;
    }

    .modal-message {
      margin: 0;
      color: #1f2937;
      font-size: 0.9375rem;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }

    @media (max-width: 640px) {
      .modal-card {
        max-height: 90vh;
      }

      .modal-header {
        padding: 1rem 1.25rem;
      }

      .modal-content {
        padding: 1.25rem;
      }

      .modal-title-text {
        font-size: 1rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'notification-modal': NotificationModal;
  }
}
