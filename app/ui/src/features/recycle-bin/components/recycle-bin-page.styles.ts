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
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
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
`;
