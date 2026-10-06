import { css } from 'lit';

export const saSshTabStyles = css`
  :host {
    display: block;
  }

  .section-title {
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
    margin: 0 0 0.75rem 0;
  }

  .key-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0 0 1.5rem 0;
    padding: 0;
    list-style: none;
  }

  .empty {
    margin-bottom: 1.5rem;
  }

  .key-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
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
  }

  .key-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.8125rem;
    color: var(--theme-color-text-primary);
    word-break: break-all;
    white-space: pre-wrap;
    margin: 0;
  }

  .add-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
  }

  .error {
    margin: 0;
    font-size: 0.875rem;
    color: var(--theme-color-error);
  }
`;
