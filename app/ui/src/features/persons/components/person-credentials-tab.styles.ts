import { css } from 'lit';

export const personCredentialsTabStyles = css`
  :host {
    display: block;
  }

  .muted {
    color: var(--theme-color-text-muted);
    font-size: 0.875rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .btn {
    padding: 0.5rem 1rem;
    border-radius: 6px;
    border: 1px solid transparent;
    font-size: 0.875rem;
    font-weight: 500;
    font-family: inherit;
    cursor: pointer;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--theme-color-primary);
    color: var(--theme-color-background);
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }

  .btn-secondary {
    background: transparent;
    border-color: var(--theme-color-border);
    color: var(--theme-color-text-secondary);
  }

  .btn-secondary:hover:not(:disabled) {
    color: var(--theme-color-text-primary);
    border-color: var(--theme-color-text-secondary);
  }

  .intent-panel {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.75rem;
    margin-bottom: 1rem;
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
  }

  .intent-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--theme-color-text-secondary);
  }

  .intent-field {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .intent-field-label {
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--theme-color-text-muted);
  }

  .intent-token {
    font-size: 0.8125rem;
    color: var(--theme-color-text-primary);
    word-break: break-all;
    background: var(--theme-color-background);
    padding: 0.5rem;
    border-radius: 6px;
  }

  .intent-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .intent-panel .btn {
    align-self: flex-start;
  }

  .qr-block {
    display: flex;
    align-items: center;
    gap: 1rem;
    align-self: flex-start;
    padding: 0.75rem;
    background: var(--theme-color-background);
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
  }

  /* QR codes must stay black-on-white for scanners to read them, so the
     backdrop is fixed and intentionally not themed. */
  .qr-image {
    display: block;
    width: 10rem;
    height: 10rem;
    background: #ffffff;
    border-radius: 4px;
  }

  .cred-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .cred-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.625rem 0.875rem;
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
  }

  .cred-type {
    font-weight: 500;
    color: var(--theme-color-text-primary);
  }

  .cred-uuid {
    font-size: 0.75rem;
    color: var(--theme-color-text-muted);
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .modal {
    background: var(--theme-color-surface);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    padding: 1.25rem;
    width: min(24rem, calc(100vw - 2rem));
  }

  .modal-title {
    margin: 0 0 1rem;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
    margin-bottom: 1rem;
  }

  .field-label {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
  }

  .field input {
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    background: var(--theme-color-background);
    color: var(--theme-color-text-primary);
    font-family: inherit;
    font-size: 0.875rem;
  }

  .field input:focus {
    outline: none;
    border-color: var(--theme-color-primary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
  }
`;
