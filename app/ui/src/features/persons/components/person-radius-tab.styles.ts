import { css } from 'lit';

export const personRadiusTabStyles = css`
  :host {
    display: block;
  }

  .section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .section-title {
    margin: 0;
    font-size: 1rem;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }

  .card-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .notice {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    padding: 8px 12px;
    font-size: 0.875rem;
    color: var(--theme-color-warning);
    background: var(--theme-color-warning-soft);
    border: 1px solid
      color-mix(in srgb, var(--theme-color-warning) 30%, transparent);
    border-radius: var(--theme-radius-md);
  }

  .secret-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .secret {
    flex: 1;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.95rem;
    color: var(--theme-color-text-primary);
    background: var(--theme-color-surface-sunken);
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-md);
    box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
    padding: 8px 12px;
    overflow-wrap: anywhere;
    user-select: all;
  }

  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
`;
