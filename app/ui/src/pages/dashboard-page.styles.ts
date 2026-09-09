import { css } from 'lit';

export const dashboardPageStyles = css`
  :host {
    display: block;
    min-height: 100vh;
  }

  .page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--theme-color-background);
    transition: background-color 0.2s ease;
  }

  .main-content {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
  }

  .dashboard-container {
    width: 100%;
    max-width: 600px;
  }

  .dashboard-card {
    background: var(--theme-color-surface);
    border-radius: 8px;
    padding: 3rem 2.5rem;
    box-shadow: var(--theme-shadow-md);
    transition:
      background-color 0.2s ease,
      box-shadow 0.2s ease;
  }

  .title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--theme-color-text-primary);
    margin: 0 0 0.5rem 0;
    transition: color 0.2s ease;
  }

  .subtitle {
    font-size: 1rem;
    color: var(--theme-color-text-secondary);
    margin: 0 0 2rem 0;
    transition: color 0.2s ease;
  }

  .user-section {
    margin: 2rem 0;
  }

  .user-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    margin: 0 0 1rem 0;
    transition: color 0.2s ease;
  }

  .user-details {
    background: var(--theme-color-background);
    border-radius: 6px;
    padding: 1.5rem;
    transition: background-color 0.2s ease;
  }

  .detail-row {
    display: flex;
    justify-content: space-between;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--theme-color-border);
    transition: border-color 0.2s ease;
  }

  .detail-row:last-child {
    border-bottom: none;
  }

  .label {
    font-weight: 600;
    color: var(--theme-color-text-secondary);
    transition: color 0.2s ease;
  }

  .value {
    color: var(--theme-color-text-primary);
    word-break: break-all;
    transition: color 0.2s ease;
  }

  .loading-message {
    text-align: center;
    padding: 2rem;
    color: var(--theme-color-text-secondary);
    transition: color 0.2s ease;
  }

  .actions {
    margin-top: 2rem;
    display: flex;
    justify-content: center;
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
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-danger {
    background: var(--theme-color-error);
    color: white;
  }

  .btn-danger:hover:not(:disabled) {
    background: #dc2626;
  }

  .btn-danger:active:not(:disabled) {
    background: #b91c1c;
  }

  .test-section {
    margin: 2rem 0;
    padding: 1.5rem;
    background: var(--theme-color-background);
    border-radius: 6px;
    transition: background-color 0.2s ease;
  }

  .test-section h2 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    margin: 0 0 0.5rem 0;
    transition: color 0.2s ease;
  }

  .test-description {
    font-size: 0.875rem;
    color: var(--theme-color-text-secondary);
    margin: 0 0 1rem 0;
    transition: color 0.2s ease;
  }

  .test-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .btn-success {
    background: var(--theme-color-success);
    color: white;
  }

  .btn-success:hover {
    background: #059669;
  }

  .btn-success:active {
    background: #047857;
  }

  .btn-error {
    background: var(--theme-color-error);
    color: white;
  }

  .btn-error:hover {
    background: #dc2626;
  }

  .btn-error:active {
    background: #b91c1c;
  }

  .btn-warning {
    background: var(--theme-color-warning);
    color: white;
  }

  .btn-warning:hover {
    background: #d97706;
  }

  .btn-warning:active {
    background: #b45309;
  }

  .btn-info {
    background: var(--theme-color-info);
    color: white;
  }

  .btn-info:hover {
    background: #2563eb;
  }

  .btn-info:active {
    background: #1d4ed8;
  }

  @media (max-width: 640px) {
    .main-content {
      padding: 1.5rem 1rem;
    }

    .dashboard-card {
      padding: 2rem 1.5rem;
    }

    .title {
      font-size: 1.75rem;
    }

    .detail-row {
      flex-direction: column;
      gap: 0.25rem;
    }
  }
`;
