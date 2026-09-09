import { css } from 'lit';

export const sessionIndicatorStyles = css`
  :host {
    display: block;
  }

  .indicator {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .user-chip {
    padding: 0.25rem 0.75rem;
    background: var(--theme-color-background);
    border: 1px solid var(--theme-color-border);
    border-radius: 999px;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-color-text-primary);
    white-space: nowrap;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease,
      color 0.2s ease;
  }

  .countdown {
    font-size: 0.875rem;
    color: var(--theme-color-text-secondary);
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    transition: color 0.2s ease;
  }

  .countdown.warning {
    color: var(--theme-color-warning);
    font-weight: 500;
  }

  .sign-out {
    border: 1px solid var(--theme-color-border);
    background: transparent;
    color: var(--theme-color-text-secondary);
    padding: 0.375rem 0.875rem;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-family: inherit;
    transition:
      color 0.2s ease,
      border-color 0.2s ease;
  }

  .sign-out:hover {
    color: var(--theme-color-error);
    border-color: var(--theme-color-error);
  }

  @media (max-width: 640px) {
    .user-chip {
      max-width: 120px;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
`;
