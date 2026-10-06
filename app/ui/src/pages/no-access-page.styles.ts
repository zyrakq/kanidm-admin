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
  ui-card {
    max-width: 480px;
  }
  h2 {
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
`;
