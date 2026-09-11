import { css } from 'lit';

export const sessionIndicatorStyles = css`
  :host {
    display: block;
  }

  .indicator {
    position: relative;
    display: flex;
    align-items: center;
  }

  .avatar-btn {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0;
    background: none;
    border: none;
    border-radius: 999px;
    cursor: pointer;
    color: var(--theme-color-text-secondary);
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .avatar-btn:hover {
    background: var(--theme-color-background);
    color: var(--theme-color-text-primary);
  }

  .avatar-btn:focus-visible {
    outline: 2px solid var(--theme-color-primary);
    outline-offset: 2px;
  }

  .countdown {
    font-size: 0.75rem;
    padding: 0.125rem 0.5rem;
    background: var(--theme-color-background);
    border: 1px solid var(--theme-color-border);
    border-radius: 999px;
    color: var(--theme-color-text-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transition: color 0.2s ease, border-color 0.2s ease;
  }

  .countdown.warning {
    color: var(--theme-color-warning);
    border-color: var(--theme-color-warning);
    font-weight: 500;
  }

  .menu {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    min-width: 220px;
    padding: 0.75rem;
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    box-shadow: var(--theme-shadow-md);
    z-index: 1000;
  }

  .display-name {
    margin: 0;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }

  .user-meta {
    margin: 0;
    font-size: 0.8125rem;
    color: var(--theme-color-text-muted);
  }

  .divider {
    height: 1px;
    background: var(--theme-color-border);
    margin: 0.625rem 0;
  }

  .session-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 0.875rem;
  }

  .session-label {
    color: var(--theme-color-text-secondary);
  }

  .session-row .countdown {
    padding: 0;
    background: none;
    border: none;
    font-size: 0.875rem;
  }

  .sign-out {
    width: 100%;
    padding: 0.5rem 0.875rem;
    border: 1px solid var(--theme-color-border);
    background: transparent;
    color: var(--theme-color-text-secondary);
    border-radius: 6px;
    cursor: pointer;
    font: inherit;
    font-size: 0.875rem;
    transition: color 0.2s ease, border-color 0.2s ease;
  }

  .sign-out:hover {
    color: var(--theme-color-error);
    border-color: var(--theme-color-error);
  }

  @media (max-width: 768px) {
    .avatar-btn .countdown {
      display: none;
    }
  }
`;
