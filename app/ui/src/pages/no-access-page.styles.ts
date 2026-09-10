import { css } from 'lit';

export const noAccessPageStyles = css`
  :host {
    display: block;
  }
  .page-title {
    margin: 0 0 20px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .card {
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    box-shadow: var(--theme-shadow-md);
    padding: 18px;
    max-width: 480px;
  }
  .card h2 {
    margin: 0 0 10px;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .muted {
    margin: 0 0 16px;
    color: var(--theme-color-text-secondary);
    font-size: 14px;
  }
  .btn {
    padding: 10px 18px;
    font-size: 14px;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    background: var(--theme-color-primary);
    color: white;
    transition: background-color 0.2s ease;
  }
  .btn:hover {
    background: var(--theme-color-primary-hover);
  }
  .btn:active {
    background: var(--theme-color-primary-active);
  }
`;
