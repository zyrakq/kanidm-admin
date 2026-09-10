import { css } from 'lit';

export const footerInfoStyles = css`
  :host {
    display: block;
    width: 100%;
  }

  footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.5rem 2rem;
    color: var(--theme-color-text-secondary);
    font-size: 0.875rem;
    max-width: 1400px;
    margin: 0 auto;
    transition: color 0.2s ease;
  }

  .left,
  .right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
    transition: color 0.2s ease;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    background: var(--theme-color-success);
    border-radius: 50%;
    transition: background-color 0.2s ease;
  }

  .status[data-state='loading'] .status-dot {
    background: var(--theme-color-text-muted);
  }

  .status[data-state='unreachable'] {
    color: var(--theme-color-error);
  }

  .status[data-state='unreachable'] .status-dot {
    background: var(--theme-color-error);
  }

  .status[data-state='version_conflict'] {
    color: var(--theme-color-warning);
  }

  .status[data-state='version_conflict'] .status-dot {
    background: var(--theme-color-warning);
  }

  .separator {
    color: var(--theme-color-border);
    transition: color 0.2s ease;
  }

  a {
    color: var(--theme-color-text-secondary);
    text-decoration: none;
    transition: color 0.2s ease;
  }

  a:hover {
    color: var(--theme-color-primary);
  }

  @media (max-width: 768px) {
    footer {
      flex-direction: column;
      gap: 0.75rem;
      padding: 1.5rem 1rem;
    }

    .left,
    .right {
      justify-content: center;
    }
  }
`;
