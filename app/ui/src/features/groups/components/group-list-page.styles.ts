import { css } from 'lit';

export const groupListPageStyles = css`
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
  .btn-delete {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: var(--theme-radius-sm);
    background: none;
    color: var(--theme-color-error);
    cursor: pointer;
    vertical-align: middle;
    transition:
      color var(--theme-duration-fast) var(--theme-ease),
      background-color var(--theme-duration-fast) var(--theme-ease);
  }
  .btn-delete:hover {
    background: var(--theme-color-error);
    color: var(--theme-color-on-primary);
  }
  .btn-delete:focus-visible {
    outline: none;
    box-shadow: var(--theme-focus-ring);
  }
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
  }
`;
