import { css } from 'lit';

export const personRadiusTabStyles = css`
  :host {
    display: block;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }

  .muted {
    color: var(--theme-color-text-muted);
    font-size: 0.9rem;
  }

  .card {
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    padding: 16px;
    box-shadow: var(--theme-shadow-md);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .secret-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .secret {
    flex: 1;
    font-family: monospace;
    font-size: 0.95rem;
    color: var(--theme-color-text-primary);
    background: var(--theme-color-background);
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    padding: 8px 10px;
    overflow-wrap: anywhere;
    user-select: all;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  button {
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 0.9rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .primary {
    background: var(--theme-color-primary);
    color: #ffffff;
  }

  .primary:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }

  .primary:active:not(:disabled) {
    background: var(--theme-color-primary-active);
  }

  .secondary {
    background: transparent;
    color: var(--theme-color-text-primary);
    border: 1px solid var(--theme-color-border);
  }

  .secondary:hover:not(:disabled) {
    background: var(--theme-color-background);
  }

  .danger {
    background: transparent;
    color: var(--theme-color-error);
    border: 1px solid var(--theme-color-error);
  }

  .danger:hover:not(:disabled) {
    background: var(--theme-color-error);
    color: #ffffff;
  }
`;
