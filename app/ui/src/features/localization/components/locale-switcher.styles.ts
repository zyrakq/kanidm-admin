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
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 6px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--theme-color-text-primary);
    transition: all 0.2s ease;
  }

  .trigger:hover {
    background: var(--theme-color-background);
    border-color: var(--theme-color-primary);
  }

  .flag {
    font-size: 1.25rem;
    line-height: 1;
  }

  .name {
    color: var(--theme-color-text-primary);
  }

  .arrow {
    font-size: 0.625rem;
    transition: transform 0.2s ease;
    color: var(--theme-color-text-muted);
  }

  .arrow.open {
    transform: rotate(180deg);
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
    padding: 0.625rem 0.75rem;
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
    color: white;
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
`;
