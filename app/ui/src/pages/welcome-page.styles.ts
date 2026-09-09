import { css } from 'lit';

export const welcomePageStyles = css`
  :host {
    display: block;
    min-height: 100vh;
  }

  .page {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
    background: var(--theme-color-background);
    transition: background-color 0.2s ease;
  }

  .main-content {
    flex: 1;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 2rem 1rem;
  }

  @media (max-width: 640px) {
    .main-content {
      padding: 1.5rem 1rem;
    }
  }
`;
