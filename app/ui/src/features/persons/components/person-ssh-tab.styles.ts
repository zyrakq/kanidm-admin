import { css } from 'lit';

export const personSshTabStyles = css`
  :host {
    display: block;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    margin: 0 0 0.75rem 0;
    transition: color 0.2s ease;
  }

  .muted {
    font-size: 0.875rem;
    color: var(--theme-color-text-muted);
    margin: 0;
    transition: color 0.2s ease;
  }

  .key-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0 0 1.5rem 0;
    padding: 0;
    list-style: none;
  }

  .key-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--theme-color-background);
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .key-body {
    flex: 1;
    min-width: 0;
  }

  .key-tag {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--theme-color-text-secondary);
    margin: 0 0 0.25rem 0;
    transition: color 0.2s ease;
  }

  .key-value {
    font-family: monospace;
    font-size: 0.8125rem;
    color: var(--theme-color-text-primary);
    word-break: break-all;
    white-space: pre-wrap;
    margin: 0;
    transition: color 0.2s ease;
  }

  .btn {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    transition: background-color 0.2s ease;
    flex-shrink: 0;
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
    filter: brightness(0.92);
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

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
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

  .input,
  .textarea {
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

  .textarea {
    font-family: monospace;
    font-size: 0.8125rem;
    min-height: 6rem;
    resize: vertical;
  }

  .input:focus,
  .textarea:focus {
    outline: none;
    border-color: var(--theme-color-primary);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .error {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-color-error);
    transition: color 0.2s ease;
  }
`;
