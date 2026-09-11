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
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .tab:hover {
    color: var(--theme-color-text-primary);
  }
  .tab.active {
    color: var(--theme-color-primary);
    border-bottom-color: var(--theme-color-primary);
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
    border-radius: 8px;
    box-shadow: var(--theme-shadow-md);
    z-index: 1000;
  }

  .menu-item {
    display: block;
    width: 100%;
    padding: 10px 12px;
    background: none;
    border: none;
    border-radius: 6px;
    font: inherit;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
    text-align: left;
    cursor: pointer;
    transition: background-color 0.15s ease, color 0.15s ease;
  }

  .menu-item:hover {
    background: var(--theme-color-background);
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
      border-radius: 6px;
      font: inherit;
      font-weight: 500;
      color: var(--theme-color-text-primary);
      cursor: pointer;
      transition: border-color 0.2s ease;
    }
    .menu-trigger:hover {
      border-color: var(--theme-color-primary);
    }
  }
`;
