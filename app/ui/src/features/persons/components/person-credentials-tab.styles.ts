import { css } from 'lit';

export const personCredentialsTabStyles = css`
  :host {
    display: block;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 16px;
  }

  .intent-card {
    display: block;
    margin-bottom: 16px;
    animation: intent-in 0.25s var(--theme-ease);
  }

  .intent-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .intent-title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }

  .intent-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .cred-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .cred-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 16px;
  }

  .cred-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .cred-type {
    font-weight: 500;
    color: var(--theme-color-text-primary);
  }

  .cred-uuid {
    font-size: 12px;
    color: var(--theme-color-text-muted);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .loading {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  [slot='footer'] {
    display: flex;
    gap: 8px;
  }

  @keyframes intent-in {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .intent-card {
      animation: none;
    }
  }
`;
