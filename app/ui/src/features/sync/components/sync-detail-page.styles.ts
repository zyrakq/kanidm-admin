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
  ui-card h2 {
    margin: 0 0 12px;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  ui-card .hint {
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
  .portal-value {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--theme-color-text-primary);
  }
  .token-reveal {
    margin-top: 12px;
    padding: 12px;
    border: 1px solid var(--theme-color-warning);
    border-radius: var(--theme-radius-md);
    background: var(--theme-color-warning-soft);
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
    border-radius: var(--theme-radius-md);
    background: var(--theme-color-surface-sunken);
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
