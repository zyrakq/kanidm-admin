import { css } from 'lit';

export const personDetailPageStyles = css`
  :host {
    display: block;
  }
  .back {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-bottom: 16px;
    font-size: 14px;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
    text-decoration: none;
  }
  .back:hover {
    color: var(--theme-color-text-primary);
  }
  .person-head {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 16px;
  }
  .btn-delete {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    margin-left: auto;
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 500;
    background: var(--theme-color-surface);
    color: var(--theme-color-error);
    cursor: pointer;
    transition: color 0.15s ease, border-color 0.15s ease,
      background-color 0.15s ease;
  }
  .btn-delete:hover:not(:disabled) {
    border-color: var(--theme-color-error);
    background: var(--theme-color-background);
  }
  .btn-delete:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .muted {
    margin: 4px 0 0;
    color: var(--theme-color-text-muted);
  }
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
  }
  .tab-content {
    padding-top: 20px;
  }
`;
