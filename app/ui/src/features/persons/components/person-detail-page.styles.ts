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
    border-radius: var(--theme-radius-sm);
    transition: color var(--theme-duration-fast) var(--theme-ease);
  }
  .back:focus-visible {
    outline: none;
    box-shadow: var(--theme-focus-ring);
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
    margin-left: auto;
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
