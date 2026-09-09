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
