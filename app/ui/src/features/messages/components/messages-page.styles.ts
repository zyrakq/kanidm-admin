import { css } from 'lit';

export const messagesPageStyles = css`
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
  .tabs {
    margin-bottom: 16px;
  }
  .send-test-card {
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    box-shadow: var(--theme-shadow-md);
    padding: 16px;
    margin-bottom: 16px;
    display: flex;
    align-items: flex-end;
    gap: 12px;
    flex-wrap: wrap;
  }
  .send-test-card form-field {
    flex: 1;
    min-width: 220px;
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
    background: var(--theme-color-border);
    color: var(--theme-color-text-secondary);
  }
  .badge.sent {
    background: var(--theme-color-success);
    color: #ffffff;
  }
  .detail-grid {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 8px 16px;
    font-size: 14px;
  }
  .detail-grid dt {
    margin: 0;
    font-weight: 600;
    color: var(--theme-color-text-secondary);
  }
  .detail-grid dd {
    margin: 0;
    color: var(--theme-color-text-primary);
    word-break: break-word;
  }
`;
