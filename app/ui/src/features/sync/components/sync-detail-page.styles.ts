import { css } from 'lit';

export const syncDetailPageStyles = css`
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
  .account-head {
    margin-bottom: 16px;
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
  .cards {
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding-top: 8px;
  }
  .card {
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    padding: 16px;
  }
  .card h2 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .card .hint {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--theme-color-text-muted);
  }
  .row {
    display: flex;
    align-items: flex-end;
    gap: 8px;
    flex-wrap: wrap;
  }
  .row form-field {
    flex: 1;
    min-width: 240px;
  }
  .btn-primary,
  .btn-secondary,
  .btn-danger {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  .btn-primary {
    background: var(--theme-color-primary);
    color: #ffffff;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }
  .btn-secondary {
    background: var(--theme-color-surface);
    color: var(--theme-color-text-primary);
    border: 1px solid var(--theme-color-border);
  }
  .btn-danger {
    background: var(--theme-color-error);
    color: #ffffff;
  }
  .btn-danger:hover:not(:disabled) {
    filter: brightness(0.9);
  }
  .btn:disabled,
  .btn-primary:disabled,
  .btn-secondary:disabled,
  .btn-danger:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .portal-value {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--theme-color-text-primary);
  }
  .token-reveal {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--theme-color-warning);
    border-radius: 6px;
    background: var(--theme-color-surface);
  }
  .token-reveal .warning {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--theme-color-warning);
  }
  .token-value {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .token-value code {
    flex: 1;
    min-width: 200px;
    padding: 8px;
    border-radius: 6px;
    background: var(--theme-color-background);
    border: 1px solid var(--theme-color-border);
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
    word-break: break-all;
  }
  .danger-zone {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .danger-note {
    margin: 0 0 12px;
    font-size: 13px;
    color: var(--theme-color-error);
  }
`;
