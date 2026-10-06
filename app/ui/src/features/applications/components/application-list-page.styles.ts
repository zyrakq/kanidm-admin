import { css } from 'lit';

export const applicationListPageStyles = css`
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
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
  }
  .detail-section {
    margin-bottom: 16px;
  }
  .detail-heading {
    margin: 0 0 8px;
    font-size: 13px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--theme-color-text-muted);
  }
  .linked-group {
    display: inline-block;
    margin: 0 8px 4px 0;
    color: var(--theme-color-primary);
    text-decoration: none;
    font-size: 14px;
  }
  .linked-group:hover {
    text-decoration: underline;
  }
  .attrs-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  .attrs-table th,
  .attrs-table td {
    text-align: left;
    padding: 6px 10px;
    border-bottom: 1px solid var(--theme-color-border);
    vertical-align: top;
  }
  .attrs-table th {
    font-weight: 600;
    color: var(--theme-color-text-secondary);
    background: var(--theme-color-surface-sunken);
  }
  .attrs-table td:first-child {
    font-family: var(--theme-font-mono, monospace);
    color: var(--theme-color-text-secondary);
    white-space: nowrap;
  }
  .attrs-table td:last-child {
    font-family: var(--theme-font-mono, monospace);
    word-break: break-all;
    color: var(--theme-color-text-primary);
  }
  .empty {
    color: var(--theme-color-text-muted);
    font-size: 13px;
    margin: 0;
  }
`;
