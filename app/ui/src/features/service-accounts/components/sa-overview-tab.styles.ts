import { css } from 'lit';

export const saOverviewTabStyles = css`
  :host {
    display: block;
  }

  .muted {
    margin: 0;
    font-size: 14px;
    color: var(--theme-color-text-muted);
  }

  .card {
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }

  .card h2 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
  }

  .primary-btn {
    padding: 9px 16px;
    border: none;
    border-radius: 6px;
    background: var(--theme-color-primary);
    color: var(--theme-color-surface);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  .primary-btn:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }

  .primary-btn:active:not(:disabled) {
    background: var(--theme-color-primary-active);
  }

  .primary-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .danger-btn {
    padding: 9px 16px;
    border: 1px solid var(--theme-color-error);
    border-radius: 6px;
    background: transparent;
    color: var(--theme-color-error);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .danger-btn:hover:not(:disabled) {
    background: var(--theme-color-error);
    color: var(--theme-color-surface);
  }

  .danger-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .group-list {
    list-style: none;
    margin: 0 0 16px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .group-list li {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 8px 12px;
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: var(--theme-color-text-primary);
    word-break: break-all;
  }

  .remove-btn {
    flex-shrink: 0;
    padding: 4px 12px;
    border: 1px solid var(--theme-color-error);
    border-radius: 6px;
    background: transparent;
    color: var(--theme-color-error);
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .remove-btn:hover:not(:disabled) {
    background: var(--theme-color-error);
    color: var(--theme-color-surface);
  }

  .remove-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .add-group {
    display: flex;
    gap: 8px;
  }

  .add-group .input {
    flex: 1;
    min-width: 0;
    padding: 9px 12px;
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    font: inherit;
    color: var(--theme-color-text-primary);
    background: var(--theme-color-surface);
    transition: border-color 0.2s ease;
  }

  .add-group .input:focus {
    outline: none;
    border-color: var(--theme-color-primary);
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

  .modal-text {
    margin: 0 0 1rem;
    font-size: 0.875rem;
    color: var(--theme-color-text-secondary);
  }

  .modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
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
`;
