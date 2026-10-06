import { css } from 'lit';

export const saOverviewTabStyles = css`
  :host {
    display: block;
  }

  .muted {
    margin: 0;
    font-size: 14px;
    color: var(--theme-color-text-muted);
  }

  ui-card {
    margin-bottom: 16px;
  }

  h2 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
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
    background: var(--theme-color-surface-sunken);
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-md);
    transition: border-color var(--theme-duration) var(--theme-ease);
  }

  .group-list li:hover {
    border-color: var(--theme-color-border-strong);
  }

  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: var(--theme-color-text-primary);
    word-break: break-all;
  }

  .add-group {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }

  .add-group form-field {
    flex: 1;
    min-width: 0;
  }
`;
