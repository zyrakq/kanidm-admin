import { css } from 'lit';

export const appHeaderStyles = css`
  :host {
    display: block;
    width: 100%;
  }

  header {
    position: sticky;
    top: 0;
    z-index: 900;
    height: 64px;
    background: var(--theme-color-surface);
    border-bottom: 1px solid var(--theme-color-border);
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .header-content {
    display: flex;
    align-items: center;
    height: 100%;
    padding: 0 24px;
    gap: 0.75rem;
  }

  .left-cluster {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  .spacer {
    flex: 1;
  }

  .right-cluster {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .logo {
    width: 40px;
    height: 40px;
    flex-shrink: 0;
  }

  .app-name {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: color 0.2s ease;
  }

  @media (max-width: 640px) {
    .header-content {
      padding: 0 12px;
    }

    .app-name {
      display: none;
    }
  }

  .burger-btn {
    display: none;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    padding: 0;
    background: none;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    color: var(--theme-color-text-primary);
    transition: background-color 0.15s ease;
    flex-shrink: 0;
  }
  .burger-btn:hover {
    background: var(--theme-color-background);
  }
  @media (max-width: 768px) {
    .burger-btn {
      display: flex;
    }

    /* The session drawer (z 1550) and locale sheet (z 1590/1595) are
       fixed inside the header's stacking context; the header must sit
       above the admin sidebar (1500) and backdrop (1400) so they paint
       over them (velora z-ladder). */
    header {
      z-index: 1600;
    }

    /* Theme + language live in the session drawer on mobile; the theme
       toggler hides in the left cluster and the right cluster reduces
       to the session avatar. */
    .right-cluster locale-switcher,
    .left-cluster theme-toggler {
      display: none;
    }
  }
`;
