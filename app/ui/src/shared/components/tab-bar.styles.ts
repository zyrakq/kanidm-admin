// Tab bar styles: horizontal strip on desktop, dropdown menu
// trigger below 768px (see tab-bar.ts).

import { css } from 'lit';

export const tabBarStyles = css`
  .tab-bar {
    position: relative;
  }

  .tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--theme-color-border);
    overflow-x: auto;
  }
  .tab {
    background: none;
    border: none;
    border-bottom: 2px solid transparent;
    padding: 10px 16px;
    font: inherit;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
    cursor: pointer;
    white-space: nowrap;
    border-radius: var(--theme-radius-md) var(--theme-radius-md) 0 0;
    transition:
      color var(--theme-duration-fast) var(--theme-ease),
      background-color var(--theme-duration-fast) var(--theme-ease),
      border-color var(--theme-duration-fast) var(--theme-ease);
  }
  .tab:hover {
    color: var(--theme-color-text-primary);
    background: var(--theme-color-surface-hover);
  }
  .tab:focus-visible {
    outline: none;
    box-shadow: var(--theme-focus-ring);
  }
  .tab.active {
    color: var(--theme-color-primary);
    border-bottom-color: var(--theme-color-primary);
    box-shadow: 0 1px 0 var(--theme-color-primary);
  }

  .trigger-label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .menu-trigger {
    display: none;
  }

  .menu-panel {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    min-width: 200px;
    padding: 4px;
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: var(--theme-radius-lg);
    box-shadow: var(--theme-elevation-2), var(--theme-highlight);
    z-index: 1000;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    border-radius: var(--theme-radius-sm);
    font: inherit;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
    text-align: left;
    cursor: pointer;
    transition:
      background-color var(--theme-duration-fast) var(--theme-ease),
      color var(--theme-duration-fast) var(--theme-ease);
  }

  .menu-item:hover {
    background: var(--theme-color-surface-hover);
    color: var(--theme-color-text-primary);
  }

  .menu-item.active {
    color: var(--theme-color-primary);
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .tab {
      flex: 1 1 auto;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
    }
  }
  @media (max-width: 640px) {
    .tab {
      padding: 8px 12px;
      font-size: 0.875rem;
    }
  }
  @media (max-width: 480px) {
    .tab {
      padding: 6px 10px;
      font-size: 0.8125rem;
    }
  }

  @media (max-width: 768px) {
    .tabs {
      display: none;
    }
    .menu-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.5rem;
      width: 100%;
      padding: 10px 14px;
      background: var(--theme-color-surface);
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-md);
      box-shadow: var(--theme-elevation-1), var(--theme-highlight);
      font: inherit;
      font-weight: 500;
      color: var(--theme-color-text-primary);
      cursor: pointer;
      transition:
        border-color var(--theme-duration-fast) var(--theme-ease),
        box-shadow var(--theme-duration-fast) var(--theme-ease);
    }
    .menu-trigger:hover {
      border-color: var(--theme-color-border-strong);
    }
    .menu-trigger:focus-visible {
      outline: none;
      border-color: var(--theme-color-primary);
      box-shadow: var(--theme-focus-ring);
    }
  }
`;
