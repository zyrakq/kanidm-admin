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
    background: var(--theme-overlay-bg);
    backdrop-filter: blur(var(--theme-overlay-blur));
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
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-xl);
    box-shadow: var(--theme-elevation-3), var(--theme-highlight);
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
    background: var(--theme-color-success-soft);
    color: var(--theme-color-success);
  }

  .modal-icon-error {
    background: var(--theme-color-error-soft);
    color: var(--theme-color-error);
  }

  .modal-icon-warning {
    background: var(--theme-color-warning-soft);
    color: var(--theme-color-warning);
  }

  .modal-icon-info {
    background: var(--theme-color-info-soft);
    color: var(--theme-color-info);
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
    border-radius: var(--theme-radius-md);
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .modal-close:hover {
    background: var(--theme-color-surface-hover);
    color: var(--theme-color-text-primary);
  }

  .modal-close:focus {
    outline: none;
    box-shadow: var(--theme-focus-ring);
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
