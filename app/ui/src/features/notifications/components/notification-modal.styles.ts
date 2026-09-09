import { css } from 'lit';

export const notificationModalStyles = css`
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
    background: var(--theme-color-surface-elevated);
    border-radius: 8px;
    box-shadow: var(--theme-shadow-lg);
    max-width: 600px;
    width: 100%;
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    animation: slideUp 0.3s ease-out;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
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
    border-bottom: 1px solid var(--theme-color-border);
    transition: border-color 0.2s ease;
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
    color: var(--theme-color-text-primary);
    transition: color 0.2s ease;
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
    color: var(--theme-color-text-secondary);
    font-size: 20px;
    cursor: pointer;
    border-radius: 6px;
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .modal-close:hover {
    background: var(--theme-color-background);
    color: var(--theme-color-text-primary);
  }

  .modal-close:focus {
    outline: 2px solid var(--theme-color-primary);
    outline-offset: 2px;
  }

  .modal-content {
    padding: 1.5rem;
    overflow-y: auto;
    flex: 1;
  }

  .modal-message {
    margin: 0;
    color: var(--theme-color-text-primary);
    font-size: 0.9375rem;
    line-height: 1.6;
    white-space: pre-wrap;
    word-break: break-word;
    transition: color 0.2s ease;
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
