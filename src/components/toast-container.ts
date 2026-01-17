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
  private static readonly MAX_VISIBLE_NOTIFICATIONS = 4;
  private static readonly DEFAULT_DURATION = 5000;
  private static readonly REMOVAL_ANIMATION_DURATION = 500;

  @state() private allNotifications: Notification[] = [];
  @state() private removingIds: Set<string> = new Set();
  private timers: Map<string, NotificationTimer> = new Map();
  private removalTimeouts: Map<string, number> = new Map();
  private isModalOpen = false;
  @query('notification-modal') private modal?: NotificationModal;

  private get visibleNotifications(): Notification[] {
    return this.allNotifications.slice(
      0,
      ToastContainer.MAX_VISIBLE_NOTIFICATIONS
    );
  }

  private get queuedCount(): number {
    return Math.max(
      0,
      this.allNotifications.length - ToastContainer.MAX_VISIBLE_NOTIFICATIONS
    );
  }

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

    // Clear all timers
    this.timers.forEach((timer) => {
      if (timer.animationFrame) {
        cancelAnimationFrame(timer.animationFrame);
      }
    });
    this.timers.clear();

    // Clear all removal timeouts
    this.removalTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.removalTimeouts.clear();
  }

  private handleAddNotification = async (event: Event) => {
    const customEvent = event as CustomEvent<Notification>;
    const notification = customEvent.detail;

    this.allNotifications = [...this.allNotifications, notification];

    await this.updateComplete;

    // Start timer only for visible notifications
    const visibleIds = this.visibleNotifications.map((n) => n.id);
    if (visibleIds.includes(notification.id)) {
      requestAnimationFrame(() => {
        const duration = notification.duration || 3000;
        this.startTimer(notification.id, duration);
      });
    }
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

    // Cancel any existing removal timeout for this id
    const existingTimeout = this.removalTimeouts.get(id);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.removalTimeouts.delete(id);
    }

    // Add to removing set to trigger animation in render
    this.removingIds = new Set([...this.removingIds, id]);

    // Schedule actual removal after animation duration
    const timeoutId = window.setTimeout(() => {
      this.removalTimeouts.delete(id);
      this.allNotifications = this.allNotifications.filter((n) => n.id !== id);
      this.removingIds = new Set(
        [...this.removingIds].filter((removingId) => removingId !== id)
      );
      // After removing, check if we need to show next from queue
      this.showNextFromQueue();
    }, ToastContainer.REMOVAL_ANIMATION_DURATION);

    this.removalTimeouts.set(id, timeoutId);
  }

  private async showNextFromQueue() {
    // Wait for rendering to complete before starting timers for newly visible notifications
    await this.updateComplete;

    const visible = this.visibleNotifications;
    visible.forEach((notification) => {
      // If this notification doesn't have a timer yet, start one
      if (!this.timers.has(notification.id)) {
        const duration =
          notification.duration || ToastContainer.DEFAULT_DURATION;
        this.startTimer(notification.id, duration);
      }
    });
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

  private handleQueueBadgeClick() {
    // Show next notification from queue (essentially same as removing the first visible one)
    const firstVisible = this.visibleNotifications[0];
    if (firstVisible) {
      this.removeNotification(firstVisible.id);
    }
  }

  private clearAllNotifications = () => {
    // Stop all timers
    this.timers.forEach((timer) => {
      if (timer.animationFrame) {
        cancelAnimationFrame(timer.animationFrame);
      }
    });
    this.timers.clear();

    // Cancel all pending removals
    this.removalTimeouts.forEach((timeoutId) => {
      clearTimeout(timeoutId);
    });
    this.removalTimeouts.clear();

    // Add all notification IDs to removing set for animation
    const allIds = this.allNotifications.map((n) => n.id);
    this.removingIds = new Set(allIds);

    // Clear everything after animation duration
    setTimeout(() => {
      this.allNotifications = [];
      this.removingIds = new Set();
    }, ToastContainer.REMOVAL_ANIMATION_DURATION);
  };

  render() {
    return html`
      <div class="toast-container">
        ${this.visibleNotifications.map((notification: Notification) => {
          const isRemoving = this.removingIds.has(notification.id);
          return html`
            <toast-notification
              class=${isRemoving ? 'removing' : ''}
              .message=${notification.message}
              .type=${notification.type}
              .notificationId=${notification.id}
              @toast-close=${this.handleClose}
              @toast-pause=${this.handlePause}
              @toast-resume=${this.handleResume}
            ></toast-notification>
          `;
        })}
        ${this.queuedCount > 0
          ? html`
              <div class="queue-actions">
                <div class="queue-badge" @click=${this.handleQueueBadgeClick}>
                  + ${this.queuedCount}
                  уведомление${this.queuedCount > 1 ? 'й' : 'е'}
                </div>
                <button
                  class="clear-all-button"
                  @click=${this.clearAllNotifications}
                  title="Закрыть все уведомления"
                >
                  <span>✕</span>Закрыть все
                </button>
              </div>
            `
          : ''}
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

    .queue-badge {
      flex: 1;
      padding: 0.75rem 1rem;
      background: #ff6b35;
      color: white;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    .queue-badge:hover {
      background: #e85d2a;
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    }

    .queue-badge:active {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    .queue-actions {
      display: flex;
      gap: 0.5rem;
      align-items: center;
      width: 100%;
      min-width: 320px;
      max-width: 420px;
    }

    .clear-all-button {
      display: flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.75rem 1rem;
      background: white;
      color: #6b7280;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      white-space: nowrap;
    }

    .clear-all-button:hover {
      background: #fef2f2;
      color: #ef4444;
      border-color: #fee2e2;
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.15);
    }

    .clear-all-button:active {
      transform: translateY(0);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }

    .clear-all-button span {
      font-size: 1rem;
      line-height: 1;
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

      .queue-badge {
        min-width: 280px;
        max-width: calc(100vw - 32px);
        margin-left: 0;
        margin-right: 0;
      }

      .queue-actions {
        flex-direction: column;
        gap: 0.25rem;
        min-width: 280px;
        max-width: calc(100vw - 32px);
      }

      .queue-badge {
        min-width: 0;
        max-width: none;
        margin-left: 0;
        margin-right: 0;
      }

      .clear-all-button {
        min-width: fit-content;
        max-width: 160px;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'toast-container': ToastContainer;
  }
}
