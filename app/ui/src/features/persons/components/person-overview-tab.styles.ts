import { css } from 'lit';

export const personOverviewTabStyles = css`
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
`;
