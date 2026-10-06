import { css } from 'lit';

export const loginFormStyles = css`
  :host {
    display: block;
    width: 100%;
    max-width: 420px;
  }

  .auth-card {
    background: var(--theme-color-surface-raised);
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-xl);
    padding: 3rem 2.5rem;
    box-shadow: var(--theme-elevation-2), var(--theme-highlight);
    text-align: center;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .logo {
    width: 240px;
    height: 240px;
    margin-bottom: 1.5rem;
  }

  .title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    margin: 0 0 0.5rem 0;
    transition: color 0.2s ease;
  }

  .subtitle {
    font-size: 0.9375rem;
    color: var(--theme-color-text-secondary);
    margin: 0 0 2rem 0;
    transition: color 0.2s ease;
  }

  .user-info {
    margin: 1.5rem 0;
    padding: 0.75rem 1rem;
    background: var(--theme-color-surface-sunken);
    border-radius: var(--theme-radius-md);
    transition: background-color 0.2s ease;
  }

  .user-name {
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--theme-color-text-primary);
    transition: color 0.2s ease;
  }

  .actions {
    margin-top: 2rem;
  }

  .form {
    margin-top: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    text-align: left;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
    transition: color 0.2s ease;
  }

  .input {
    padding: 0.625rem 0.875rem;
    font-size: 0.9375rem;
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-md);
    background: var(--theme-color-surface-sunken);
    color: var(--theme-color-text-primary);
    font-family: inherit;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  .input:focus {
    outline: none;
    border-color: var(--theme-color-primary);
    box-shadow: var(--theme-focus-ring);
  }

  .error {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-color-error);
    transition: color 0.2s ease;
  }

  @media (max-width: 640px) {
    .auth-card {
      padding: 2rem 1.5rem;
    }

    .logo {
      width: 220px;
      height: 220px;
    }

    .title {
      font-size: 1.375rem;
    }

    .subtitle {
      font-size: 0.875rem;
    }
  }

  @media (min-width: 769px) {
    :host {
      max-width: 760px;
    }

    .auth-card {
      display: flex;
      align-items: stretch;
      gap: 2.5rem;
      padding: 2.5rem 3rem;
      text-align: left;
    }

    .brand {
      display: flex;
      align-items: center;
      flex-shrink: 0;
      padding-right: 2.5rem;
      border-right: 1px solid var(--theme-color-border);
    }

    .logo {
      width: 200px;
      height: 200px;
      margin-bottom: 0;
    }

    .panel {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-width: 0;
    }
  }
`;
