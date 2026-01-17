export type NotificationType = 'success' | 'error' | 'warning' | 'info';

export interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  duration?: number;
}

export interface NotificationOptions {
  duration?: number;
}

export class NotificationAddEvent extends CustomEvent<Notification> {
  constructor(notification: Notification) {
    super('notification-add', {
      detail: notification,
      bubbles: true,
      composed: true,
    });
  }
}

export class NotificationRemoveEvent extends CustomEvent<string> {
  constructor(id: string) {
    super('notification-remove', {
      detail: id,
      bubbles: true,
      composed: true,
    });
  }
}

declare global {
  interface HTMLElementEventMap {
    'notification-add': NotificationAddEvent;
    'notification-remove': NotificationRemoveEvent;
  }
}
