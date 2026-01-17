import { LitElement, css, html } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import type { Notification } from '@/types/notification.types.ts';
import '@/components/toast-notification.ts';
import '@/components/notification-modal.ts';
import type { NotificationModal } from '@/components/notification-modal.ts';

interface NotificationTimer {
  id: string;
  startTime: number;
  duration: number;
  pausedAt: number | null;
  animationFrame: number | null;
}

@customElement('toast-container')
export class ToastContainer extends LitElement {
  @state() private notifications: Notification[] = [];
  private timers: Map<string, NotificationTimer> = new Map();
  private isModalOpen = false;
  @query('notification-modal') private modal?: NotificationModal;

  connectedCallback() {
    super.connectedCallback();
    window.addEventListener('notification-add', this.handleAddNotification);
    window.addEventListener(
      'notification-remove',
      this.handleRemoveNotification
    );
    window.addEventListener('modal-opened', this.handleModalOpened);
    window.addEventListener('modal-closed', this.handleModalClosed);
    window.addEventListener('open-notification-modal', this.handleOpenModal);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('notification-add', this.handleAddNotification);
    window.removeEventListener(
      'notification-remove',
      this.handleRemoveNotification
    );
    window.removeEventListener('modal-opened', this.handleModalOpened);
    window.removeEventListener('modal-closed', this.handleModalClosed);
    window.removeEventListener('open-notification-modal', this.handleOpenModal);
    this.timers.forEach((timer) => {
      if (timer.animationFrame) {
        cancelAnimationFrame(timer.animationFrame);
      }
    });
    this.timers.clear();
  }

  private handleAddNotification = async (event: Event) => {
    const customEvent = event as CustomEvent<Notification>;
    const notification = customEvent.detail;

    this.notifications = [...this.notifications, notification];

    await this.updateComplete;

    requestAnimationFrame(() => {
      const duration = notification.duration || 3000;
      this.startTimer(notification.id, duration);
    });
  };

  private handleRemoveNotification = (event: Event) => {
    const customEvent = event as CustomEvent<string>;
    this.removeNotification(customEvent.detail);
  };

  private startTimer(id: string, duration: number) {
    const timer: NotificationTimer = {
      id,
      startTime: Date.now(),
      duration,
      pausedAt: this.isModalOpen ? Date.now() : null,
      animationFrame: null,
    };

    this.timers.set(id, timer);

    // Only start animation if modal is not open
    if (!this.isModalOpen) {
      this.animateTimer(id);
    } else {
      // If modal is open, keep opacity at 1
      const element = this.shadowRoot?.querySelector(
        `toast-notification[notificationId="${id}"]`
      ) as HTMLElement;
      if (element) {
        element.style.setProperty('--toast-opacity', '1');
      }
    }
  }

  private animateTimer(id: string) {
    const timer = this.timers.get(id);
    if (!timer || timer.pausedAt !== null) {
      return;
    }

    const element = this.shadowRoot?.querySelector(
      `toast-notification[notificationId="${id}"]`
    ) as HTMLElement;

    if (!element) return;

    const elapsed = Date.now() - timer.startTime;
    const progress = Math.min(elapsed / timer.duration, 1);
    const opacity = 1 - progress;

    element.style.setProperty('--toast-opacity', opacity.toString());

    if (progress >= 1) {
      this.removeNotification(id);
    } else {
      timer.animationFrame = requestAnimationFrame(() => this.animateTimer(id));
    }
  }

  private pauseTimer(id: string) {
    const timer = this.timers.get(id);
    if (!timer) {
      return;
    }

    // Only pause if not already paused
    if (timer.pausedAt !== null) {
      return;
    }

    timer.pausedAt = Date.now();
    if (timer.animationFrame) {
      cancelAnimationFrame(timer.animationFrame);
      timer.animationFrame = null;
    }

    const element = this.shadowRoot?.querySelector(
      `toast-notification[notificationId="${id}"]`
    ) as HTMLElement;

    if (element) {
      element.style.setProperty('--toast-opacity', '1');
    }
  }

  private resumeTimer(id: string) {
    const timer = this.timers.get(id);
    if (!timer || timer.pausedAt === null) {
      return;
    }

    // Don't resume if modal is open
    if (this.isModalOpen) {
      return;
    }

    timer.startTime = Date.now();
    timer.pausedAt = null;

    this.animateTimer(id);
  }

  private removeNotification(id: string) {
    const timer = this.timers.get(id);
    if (timer?.animationFrame) {
      cancelAnimationFrame(timer.animationFrame);
    }
    this.timers.delete(id);

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

  private handlePause(event: Event) {
    const customEvent = event as CustomEvent<string>;
    this.pauseTimer(customEvent.detail);
  }

  private handleResume(event: Event) {
    const customEvent = event as CustomEvent<string>;
    this.resumeTimer(customEvent.detail);
  }

  private handleOpenModal = (event: Event) => {
    const customEvent = event as CustomEvent<{
      message: string;
      type: string;
    }>;
    if (this.modal) {
      this.modal.message = customEvent.detail.message;
      this.modal.type = customEvent.detail.type as any;
      this.modal.open();
    }
  };

  private handleModalOpened = () => {
    this.isModalOpen = true;

    // Pause all timers when modal opens (unconditionally, to override any resume events)
    this.timers.forEach((timer) => {
      this.pauseTimer(timer.id);
    });
  };

  private handleModalClosed = () => {
    this.isModalOpen = false;

    // Resume all timers when modal closes (only if they were paused)
    this.timers.forEach((timer) => {
      if (timer.pausedAt !== null) {
        this.resumeTimer(timer.id);
      }
    });
  };

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
              @toast-pause=${this.handlePause}
              @toast-resume=${this.handleResume}
            ></toast-notification>
          `
        )}
      </div>
      <notification-modal></notification-modal>
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
