import { css } from 'lit';

export const toastNotificationStyles = css`
  :host {
    display: block;
    animation: slideIn var(--theme-duration) var(--theme-ease);
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
    background: var(--theme-color-surface-elevated);
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-lg);
    box-shadow: var(--theme-elevation-3), var(--theme-highlight);
    min-width: 320px;
    max-width: 420px;
    border-left: 3px solid;
    opacity: var(--toast-opacity, 1);
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .toast-success {
    border-left-color: var(--theme-color-success);
  }

  .toast-error {
    border-left-color: var(--theme-color-error);
  }

  .toast-warning {
    border-left-color: var(--theme-color-warning);
  }

  .toast-info {
    border-left-color: var(--theme-color-info);
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
    background: var(--theme-color-success-soft);
    color: var(--theme-color-success);
  }

  .toast-error .toast-icon {
    background: var(--theme-color-error-soft);
    color: var(--theme-color-error);
  }

  .toast-warning .toast-icon {
    background: var(--theme-color-warning-soft);
    color: var(--theme-color-warning);
  }

  .toast-info .toast-icon {
    background: var(--theme-color-info-soft);
    color: var(--theme-color-info);
  }

  .toast-message {
    flex: 1;
    color: var(--theme-color-text-primary);
    font-size: 0.875rem;
    font-weight: 500;
    line-height: 1.4;
    transition: color 0.2s ease;
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
      transparent,
      var(--theme-color-surface-elevated)
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
    transform: translateY(-1px);
    border-color: var(--theme-color-border-strong);
  }

  .toast-clickable:active {
    transform: translateY(0);
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
    color: var(--theme-color-text-secondary);
    font-size: 16px;
    cursor: pointer;
    flex-shrink: 0;
    transition: color 0.2s ease;
  }

  .toast-close:hover {
    color: var(--theme-color-text-primary);
  }

  .toast-close:focus {
    outline: none;
    box-shadow: var(--theme-focus-ring);
    border-radius: var(--theme-radius-sm);
  }

  @media (max-width: 640px) {
    .toast {
      min-width: 280px;
      max-width: calc(100vw - 32px);
    }
  }
`;
