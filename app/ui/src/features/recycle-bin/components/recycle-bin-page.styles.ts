import { css } from 'lit';

export const recycleBinPageStyles = css`
  :host {
    display: block;
  }
  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
  }
  .btn-primary {
    background: var(--theme-color-primary);
    color: #ffffff;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: var(--theme-color-surface);
    color: var(--theme-color-text-primary);
    border: 1px solid var(--theme-color-border);
  }
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
  }
  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    background: var(--theme-color-surface);
    color: var(--theme-color-text-secondary);
    border: 1px solid var(--theme-color-border);
    margin-right: 4px;
  }
  .attr-list {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .attr-row {
    display: flex;
    gap: 12px;
    padding: 6px 0;
    border-bottom: 1px solid var(--theme-color-border);
  }
  .attr-row:last-child {
    border-bottom: none;
  }
  .attr-key {
    flex: 0 0 180px;
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
    color: var(--theme-color-text-secondary);
    word-break: break-all;
  }
  .attr-values {
    flex: 1;
    min-width: 0;
  }
  .attr-value {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
    color: var(--theme-color-text-primary);
    word-break: break-all;
  }
  .empty {
    text-align: center;
    color: var(--theme-color-text-muted);
    padding: 24px 14px;
  }
`;
