import { css } from 'lit';

export const oauth2ListPageStyles = css`
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
    transition: color 0.15s ease, background-color 0.15s ease;
  }
  .btn-delete:hover {
    background: var(--theme-color-error);
    color: var(--theme-color-on-primary);
  }
`;
