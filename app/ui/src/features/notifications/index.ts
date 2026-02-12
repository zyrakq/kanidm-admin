// Public API for notifications feature
export { ToastContainer } from './components/toast-container.ts';
export { NotificationModal } from './components/notification-modal.ts';
export { notificationService } from './services/notification.service.ts';
export type {
  Notification,
  NotificationType,
  NotificationOptions,
} from './types/notification.types.ts';
