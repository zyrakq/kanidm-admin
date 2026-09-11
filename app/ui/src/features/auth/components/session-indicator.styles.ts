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

  .drawer {
    position: fixed;
    top: var(--header-height, 64px);
    left: 0;
    right: 0;
    bottom: 0;
    background: var(--theme-color-surface);
    z-index: 1550;
    transform: translateX(100%);
    visibility: hidden;
    transition: transform 0.3s ease, visibility 0s linear 0.3s;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .drawer.open {
    transform: translateX(0);
    visibility: visible;
    transition: transform 0.3s ease;
  }

  .drawer-profile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.375rem;
    padding: 1.25rem 1rem;
    border-bottom: 1px solid var(--theme-color-border);
  }
  .drawer-username {
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .drawer-user-subtitle {
    font-size: 0.8125rem;
    color: var(--theme-color-text-muted);
  }

  .drawer-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1.25rem;
    background: none;
    border: none;
    border-bottom: 1px solid var(--theme-color-border);
    cursor: pointer;
    color: var(--theme-color-text-primary);
    font: inherit;
    font-size: 0.95rem;
    text-align: left;
    transition: background-color 0.15s ease;
  }
  .drawer-row:hover {
    background: var(--theme-color-background);
  }
  .drawer-row:focus-visible {
    outline: 2px solid var(--theme-color-primary);
    outline-offset: -2px;
  }
  .drawer-row-label {
    flex: 1;
  }
  .drawer-row-value {
    color: var(--theme-color-text-secondary);
  }
  .drawer-row .countdown {
    padding: 0;
    background: none;
    border: none;
    font-size: 0.95rem;
    color: var(--theme-color-text-secondary);
  }
  .drawer-row .countdown.warning {
    color: var(--theme-color-warning);
    font-weight: 500;
  }

  .theme-track {
    width: 44px;
    height: 24px;
    border-radius: 999px;
    background: var(--theme-color-border);
    position: relative;
    flex-shrink: 0;
    transition: background-color 0.2s ease;
  }
  .theme-track.active {
    background: var(--theme-color-primary);
  }
  .theme-thumb {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: var(--theme-color-surface);
    transition: transform 0.2s ease;
  }
  .theme-track.active .theme-thumb {
    transform: translateX(20px);
  }

  .drawer-row.danger {
    color: var(--theme-color-error);
  }
  .drawer-row.danger:hover {
    background: var(--theme-color-background);
  }
`;
