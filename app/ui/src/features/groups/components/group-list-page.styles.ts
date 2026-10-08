import { css } from 'lit';

export const groupListPageStyles = css`
  :host {
    display: block;
  }
  .page-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  h1 {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
  }
  .head-tools {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .toggle-inline {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: var(--theme-color-text-primary);
    cursor: pointer;
    user-select: none;
  }
  .switch {
    position: relative;
    display: inline-block;
    width: 40px;
    height: 22px;
    flex-shrink: 0;
  }
  .switch input {
    opacity: 0;
    width: 0;
    height: 0;
  }
  .slider {
    position: absolute;
    inset: 0;
    background: var(--theme-color-border);
    border-radius: 22px;
    transition: background-color var(--theme-duration) var(--theme-ease);
  }
  .slider::before {
    content: '';
    position: absolute;
    width: 16px;
    height: 16px;
    left: 3px;
    top: 3px;
    border-radius: 50%;
    background: var(--theme-color-surface);
    transition: transform var(--theme-duration) var(--theme-ease);
  }
  .switch input:checked + .slider {
    background: var(--theme-color-primary);
  }
  .switch input:checked + .slider::before {
    transform: translateX(18px);
  }
`;
