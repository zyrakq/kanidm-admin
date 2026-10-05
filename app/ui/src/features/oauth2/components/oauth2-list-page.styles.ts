import { css } from 'lit';

export const oauth2ListPageStyles = css`
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
    border-radius: 999px;
    font-size: 12px;
    font-weight: 500;
    border: 1px solid var(--theme-color-border);
    color: var(--theme-color-text-secondary);
    background: var(--theme-color-surface);
  }
  .badge-public {
    border-color: var(--theme-color-info);
    color: var(--theme-color-info);
  }
  .btn-delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    padding: 0;
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    background: var(--theme-color-surface);
    color: var(--theme-color-text-secondary);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease,
      background-color 0.15s ease;
  }
  .btn-delete:hover {
    color: var(--theme-color-error);
    border-color: var(--theme-color-error);
    background: var(--theme-color-background);
  }
`;
