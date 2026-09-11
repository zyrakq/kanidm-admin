import { css } from 'lit';

export const themeTogglerStyles = css`
  :host {
    display: inline-block;
  }

  .toggler {
    width: 40px;
    height: 40px;
    padding: 0;
    background: transparent;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--theme-color-primary);
    transition: background-color 0.2s ease, color 0.2s ease;
    font-family: inherit;
  }

  .toggler:hover {
    background: var(--theme-color-background);
  }

  .toggler:focus-visible {
    outline: 2px solid var(--theme-color-primary);
    outline-offset: 2px;
  }

  .icon {
    width: 22px;
    height: 22px;
  }
`;
