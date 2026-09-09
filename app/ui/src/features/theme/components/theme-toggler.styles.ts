import { css } from 'lit';

export const themeTogglerStyles = css`
  :host {
    display: inline-block;
  }

  .toggler {
    background: transparent;
    border: 1px solid var(--theme-color-border, #e5e7eb);
    border-radius: 6px;
    padding: 0.5rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-color-text-primary, #1f2937);
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
    font-family: inherit;
  }

  .toggler:hover {
    background: var(--theme-color-surface, #ffffff);
    border-color: var(--theme-color-text-muted, #9ca3af);
  }

  .toggler:focus-visible {
    outline: 2px solid var(--theme-color-primary, #ff6b35);
    outline-offset: 2px;
  }

  .icon {
    width: 20px;
    height: 20px;
  }
`;
