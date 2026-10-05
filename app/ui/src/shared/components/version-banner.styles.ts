import { css } from 'lit';

export const versionBannerStyles = css`
  :host {
    display: block;
  }

  .banner {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.625rem 0.875rem;
    margin-bottom: 16px;
    border: 1px solid;
    border-radius: 8px;
    font-size: 0.875rem;
    line-height: 1.45;
    transition:
      background-color 0.2s ease,
      border-color 0.2s ease;
  }

  .banner.warning {
    border-color: var(--theme-color-warning);
    background: rgba(245, 158, 11, 0.1);
  }

  .banner.error {
    border-color: var(--theme-color-error);
    background: rgba(239, 68, 68, 0.1);
  }

  .icon {
    flex-shrink: 0;
    margin-top: 1px;
    color: var(--theme-color-text-primary);
  }

  .banner.warning .icon {
    color: var(--theme-color-warning);
  }

  .banner.error .icon {
    color: var(--theme-color-error);
  }

  .text {
    flex: 1;
    min-width: 0;
    color: var(--theme-color-text-primary);
  }

  .title {
    display: block;
    font-weight: 600;
    margin-bottom: 2px;
  }

  .detail {
    display: block;
    color: var(--theme-color-text-secondary);
  }

  .close {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    cursor: pointer;
    color: var(--theme-color-text-secondary);
    transition:
      background-color 0.2s ease,
      color 0.2s ease;
  }

  .close:hover {
    background: var(--theme-color-border);
    color: var(--theme-color-text-primary);
  }
`;
