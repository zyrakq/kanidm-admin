import { css } from 'lit';

export const toastContainerStyles = css`
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
    background: var(--theme-color-primary);
    color: var(--theme-color-on-primary);
    border-radius: var(--theme-radius-lg);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--theme-elevation-2), var(--theme-highlight);
  }

  .queue-badge:hover {
    background: var(--theme-color-primary-hover);
    transform: translateY(-1px);
  }

  .queue-badge:active {
    transform: translateY(0);
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
    background: var(--theme-color-surface-elevated);
    color: var(--theme-color-text-secondary);
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-lg);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--theme-elevation-2), var(--theme-highlight);
    white-space: nowrap;
  }

  .clear-all-button:hover {
    background: var(--theme-color-error-soft);
    color: var(--theme-color-error);
    border-color: var(--theme-color-error);
    transform: translateY(-1px);
  }

  .clear-all-button:active {
    transform: translateY(0);
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
