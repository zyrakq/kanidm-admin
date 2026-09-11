import { css } from 'lit';

export const localeBottomSheetStyles = css`
  *,
  *::before,
  *::after {
    box-sizing: border-box;
  }

  :host {
    display: contents;
  }

  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1590;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.25s ease;
  }
  .sheet-backdrop.open {
    opacity: 1;
    pointer-events: auto;
  }

  .sheet-panel {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 60vh;
    background: var(--theme-color-surface);
    border-radius: 16px 16px 0 0;
    box-shadow: var(--theme-shadow-lg);
    z-index: 1595;
    transform: translateY(100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .sheet-panel.open {
    transform: translateY(0);
  }

  .sheet-handle {
    width: 40px;
    height: 4px;
    border-radius: 2px;
    background: var(--theme-color-border);
    margin: 12px auto 0;
    flex-shrink: 0;
  }

  .sheet-header {
    padding: 1rem 1.25rem 0.75rem;
    font-weight: 600;
    font-size: 1rem;
    color: var(--theme-color-text-primary);
    border-bottom: 1px solid var(--theme-color-border);
    flex-shrink: 0;
  }

  .sheet-list {
    padding: 0.5rem 0;
  }

  .sheet-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.875rem 1.25rem;
    background: none;
    border: none;
    cursor: pointer;
    color: var(--theme-color-text-primary);
    font-family: inherit;
    transition: background 0.15s ease;
  }
  .sheet-item:hover {
    background: var(--theme-color-background);
  }
  .sheet-item:focus-visible {
    outline: 2px solid var(--theme-color-primary);
    outline-offset: -2px;
  }
  .sheet-item.active {
    color: var(--theme-color-primary);
    font-weight: 500;
  }

  .sheet-flag {
    font-size: 1.25rem;
    line-height: 1;
  }

  .sheet-name {
    flex: 1;
    text-align: left;
    font-size: 0.95rem;
  }

  .sheet-check {
    color: var(--theme-color-primary);
    flex-shrink: 0;
  }
`;
