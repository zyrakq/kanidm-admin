import { css } from 'lit';

export const reauthModalStyles = css`
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
    max-width: 420px;
    width: 100%;
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
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    transition: color 0.2s ease;
  }

  .modal-content {
    padding: 1.5rem;
  }

  .modal-message {
    margin: 0 0 1.25rem 0;
    color: var(--theme-color-text-primary);
    font-size: 0.9375rem;
    line-height: 1.6;
    transition: color 0.2s ease;
  }

  .form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
    transition: color 0.2s ease;
  }

  .input {
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    background: var(--theme-color-background);
    color: var(--theme-color-text-primary);
    font-family: inherit;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  .input:focus {
    outline: none;
    border-color: var(--theme-color-primary);
  }

  .error {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-color-error);
    transition: color 0.2s ease;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
  }

  .btn {
    padding: 0.5rem 1.25rem;
    font-size: 0.9375rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--theme-color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }

  .btn-primary:active:not(:disabled) {
    background: var(--theme-color-primary-active);
  }

  .btn-secondary {
    background: transparent;
    color: var(--theme-color-text-secondary);
    border: 1px solid var(--theme-color-border);
    transition:
      color 0.2s ease,
      border-color 0.2s ease;
  }

  .btn-secondary:hover {
    color: var(--theme-color-text-primary);
    border-color: var(--theme-color-text-secondary);
  }
`;
