import { css } from 'lit';

export const appHeaderStyles = css`
  :host {
    display: block;
    width: 100%;
  }

  header {
    background: var(--theme-color-surface);
    border-bottom: 1px solid var(--theme-color-border);
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 2rem;
    max-width: 1400px;
    margin: 0 auto;
  }

  .logo-section {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .logo {
    width: 48px;
    height: 48px;
  }

  .app-name {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    transition: color 0.2s ease;
  }

  .actions {
    display: flex;
    gap: 1rem;
  }

  @media (max-width: 640px) {
    .header-content {
      padding: 0.75rem 1rem;
    }

    .app-name {
      font-size: 1.125rem;
    }

    .logo {
      width: 40px;
      height: 40px;
    }
  }

  @media (max-width: 540px) {
    .app-name {
      display: none;
    }
  }
`;
