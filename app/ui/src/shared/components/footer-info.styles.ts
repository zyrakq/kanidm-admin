import { css } from 'lit';

export const footerInfoStyles = css`
  :host {
    display: block;
    width: 100%;
  }

  footer {
    background: var(--theme-color-surface);
    border-top: 1px solid var(--theme-color-border);
    color: var(--theme-color-text-secondary);
    font-size: 0.875rem;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .toolbar {
    display: flex;
    align-items: center;
    min-height: 48px;
    padding: 0 16px;
    gap: 1rem;
  }

  .spacer {
    flex: 1;
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
    .toolbar {
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      padding: 1rem 16px;
      min-height: unset;
    }

    .spacer {
      display: none;
    }

    .left,
    .right {
      justify-content: center;
    }
  }
`;
