import type {
  Notification,
  NotificationType,
  NotificationOptions,
} from '/workspace/kanidm-admin/src/types/notification.types.ts';

class NotificationService {
  private generateId(): string {
    return `notification-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  }

  private dispatch(
    message: string,
    type: NotificationType,
    options?: NotificationOptions
  ): void {
    const notification: Notification = {
      id: this.generateId(),
      message,
      type,
      duration: options?.duration,
    };

    window.dispatchEvent(
      new CustomEvent('notification-add', {
        detail: notification,
        bubbles: true,
        composed: true,
      })
    );
  }

  success(message: string, options?: NotificationOptions): void {
    this.dispatch(message, 'success', options);
  }

  error(message: string, options?: NotificationOptions): void {
    this.dispatch(message, 'error', options);
  }

  warning(message: string, options?: NotificationOptions): void {
    this.dispatch(message, 'warning', options);
  }

  info(message: string, options?: NotificationOptions): void {
    this.dispatch(message, 'info', options);
  }

  show(
    message: string,
    type: NotificationType,
    options?: NotificationOptions
  ): void {
    this.dispatch(message, type, options);
  }
}

export const notificationService = new NotificationService();
