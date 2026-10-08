import { css } from 'lit';

export const localeSwitcherStyles = css`
  :host {
    display: inline-block;
    position: relative;
  }

  .locale-switcher {
    position: relative;
    display: inline-block;
  }

  .trigger {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 40px;
    padding: 0 8px;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--theme-color-text-secondary);
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .trigger:hover {
    background: var(--theme-color-background);
    color: var(--theme-color-text-primary);
  }

  .trigger:focus-visible {
    outline: 2px solid var(--theme-color-primary);
    outline-offset: 2px;
  }

  .code {
    letter-spacing: 0.02em;
  }

  .dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    min-width: 200px;
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    box-shadow: var(--theme-shadow-md);
    overflow: visible;
    z-index: 1000;
    margin-top: 0.25rem;
  }

  .locale-list {
    padding: 0.5rem;
  }

  .locale-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 8px 14px;
    border: none;
    border-radius: 4px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    font-size: 0.875rem;
    color: var(--theme-color-text-primary);
    transition: background-color 0.15s ease;
  }

  .locale-item:hover {
    background: var(--theme-color-background);
  }

  .locale-item.active {
    background: var(--theme-color-primary);
    color: var(--theme-color-on-primary);
  }

  .locale-item .flag {
    font-size: 1.25rem;
  }

  .locale-item .name {
    flex: 1;
  }

  .checkmark {
    font-size: 1rem;
    font-weight: 700;
  }

  @media (max-width: 480px) {
    .trigger .code {
      display: none;
    }
    .trigger {
      width: 40px;
      padding: 0;
      justify-content: center;
    }
    .trigger ui-icon:last-child {
      display: none;
    }
  }
`;
