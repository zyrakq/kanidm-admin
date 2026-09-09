import { css } from 'lit';

export const oauthCallbackStyles = css`
  :host {
    display: block;
    min-height: 100vh;
    background: var(--theme-color-background);
    transition: background-color 0.2s ease;
  }

  .callback-container {
    display: flex;
    justify-content: center;
    align-items: center;
    min-height: 100vh;
    padding: 2rem 1rem;
  }

  .callback-card {
    background: var(--theme-color-surface);
    border-radius: 8px;
    padding: 3rem 2.5rem;
    box-shadow: var(--theme-shadow-md);
    text-align: center;
    max-width: 420px;
    width: 100%;
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    margin: 1rem 0 0.5rem 0;
    transition: color 0.2s ease;
  }

  p {
    font-size: 0.9375rem;
    color: var(--theme-color-text-secondary);
    margin: 0 0 1.5rem 0;
    transition: color 0.2s ease;
  }

  .spinner {
    border: 3px solid var(--theme-color-border);
    border-top: 3px solid var(--theme-color-primary);
    border-radius: 50%;
    width: 48px;
    height: 48px;
    animation: spin 1s linear infinite;
    margin: 0 auto 1.5rem;
    transition: border-color 0.2s ease;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .success-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--theme-color-success);
    color: white;
    font-size: 2.5rem;
    line-height: 64px;
    margin: 0 auto 1rem;
  }

  .error-icon {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    background: var(--theme-color-error);
    color: white;
    font-size: 2.5rem;
    line-height: 64px;
    margin: 0 auto 1rem;
  }

  .btn {
    padding: 0.75rem 2rem;
    font-size: 0.9375rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    background: var(--theme-color-primary);
    color: white;
    font-family: inherit;
    transition: background-color 0.2s ease;
  }

  .btn:hover {
    background: var(--theme-color-primary-hover);
  }

  @media (max-width: 640px) {
    .callback-card {
      padding: 2rem 1.5rem;
    }
  }
`;
