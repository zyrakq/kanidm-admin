import { css } from 'lit';

export const saCredentialsTabStyles = css`
  :host {
    display: block;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .cred-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cred-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
  }

  .cred-type {
    font-weight: 500;
    color: var(--theme-color-text-primary);
  }

  .cred-uuid {
    font-size: 12px;
    color: var(--theme-color-text-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .warning {
    margin: 0 0 12px;
    font-size: 13px;
    font-weight: 500;
    color: var(--theme-color-warning);
  }

  .generated {
    display: block;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: var(--theme-color-text-primary);
    word-break: break-all;
    background: var(--theme-color-surface-sunken);
    border: 1px solid var(--theme-color-border);
    padding: 8px 12px;
    border-radius: var(--theme-radius-md);
  }

  [slot='footer'] {
    display: flex;
    gap: 8px;
  }
`;
