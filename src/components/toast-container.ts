import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import type { Notification } from '/workspace/kanidm-admin/src/types/notification.types.ts';
import '/workspace/kanidm-admin/src/components/toast-notification.ts';

@customElement('toast-container')
export class ToastContainer extends LitElement {
  @state() private notifications: Notification[] = [];

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('notification-add', this.handleAddNotification);
    window.addEventListener(
      'notification-remove',
      this.handleRemoveNotification
    );
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('notification-add', this.handleAddNotification);
    window.removeEventListener(
      'notification-remove',
      this.handleRemoveNotification
    );
  }

  private handleAddNotification = (event: Event) => {
    const customEvent = event as CustomEvent<Notification>;
    const notification = customEvent.detail;

    this.notifications = [...this.notifications, notification];

    const duration = notification.duration || 3000;
    setTimeout(() => {
      this.removeNotification(notification.id);
    }, duration);
  };

  private handleRemoveNotification = (event: Event) => {
    const customEvent = event as CustomEvent<string>;
    this.removeNotification(customEvent.detail);
  };

  private removeNotification(id: string) {
    const element = this.shadowRoot?.querySelector(
      `toast-notification[notificationId="${id}"]`
    ) as HTMLElement;

    if (element) {
      element.classList.add('removing');
      setTimeout(() => {
        this.notifications = this.notifications.filter((n) => n.id !== id);
      }, 300);
    } else {
      this.notifications = this.notifications.filter((n) => n.id !== id);
    }
  }

  private handleClose(event: Event) {
    const customEvent = event as CustomEvent<string>;
    this.removeNotification(customEvent.detail);
  }

  render() {
    return html`
      <div class="toast-container">
        ${this.notifications.map(
          (notification) => html`
            <toast-notification
              .message=${notification.message}
              .type=${notification.type}
              .notificationId=${notification.id}
              @toast-close=${this.handleClose}
            ></toast-notification>
          `
        )}
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      position: fixed;
      top: 16px;
      right: 16px;
      z-index: 9999;
      pointer-events: none;
    }

    .toast-container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      pointer-events: auto;
    }

    @media (max-width: 640px) {
      :host {
        top: 8px;
        right: 8px;
        left: 8px;
      }

      .toast-container {
        align-items: stretch;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-container': ToastContainer;
  }
}
