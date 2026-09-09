import { css } from 'lit';

export const loginFormStyles = css`
  :host {
    display: block;
    width: 100%;
    max-width: 420px;
  }

  .auth-card {
    background: var(--theme-color-surface);
    border-radius: 8px;
    padding: 3rem 2.5rem;
    box-shadow: var(--theme-shadow-md);
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
    background: var(--theme-color-background);
    border-radius: 6px;
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
    border-radius: 6px;
    background: var(--theme-color-background);
    color: var(--theme-color-text-primary);
    font-family: inherit;
    transition:
      border-color 0.2s ease,
      background-color 0.2s ease;
  }

  .input:focus {
    outline: none;
    border-color: var(--theme-color-primary);
  }

  .error {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-color-error);
    transition: color 0.2s ease;
  }

  .btn {
    padding: 0.75rem 2rem;
    font-size: 0.9375rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: background-color 0.2s ease;
    font-family: inherit;
    width: 100%;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-primary {
    background: var(--theme-color-primary);
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }

  .btn-primary:active:not(:disabled) {
    background: var(--theme-color-primary-active);
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
`;
