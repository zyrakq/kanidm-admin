import { css } from 'lit';

export const adminOverviewPageStyles = css`
  :host {
    display: block;
  }
  .page-title {
    margin: 0 0 20px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 28px;
  }
  .card {
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    box-shadow: var(--theme-shadow-md);
    padding: 18px;
  }
  .card h2 {
    margin: 0 0 10px;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-color-text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .big {
    margin: 0 0 4px;
    font-size: 18px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .muted {
    margin: 0 0 4px;
    color: var(--theme-color-text-secondary);
    font-size: 14px;
  }
  .links {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 8px;
  }
  .link {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 14px;
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    background: var(--theme-color-surface);
    color: var(--theme-color-text-primary);
    text-decoration: none;
    font-weight: 500;
    transition: border-color 0.2s ease;
  }
  .link:hover {
    border-color: var(--theme-color-primary);
  }
`;
