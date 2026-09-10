import { css } from 'lit';

export const domainPageStyles = css`
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
  .card {
    background: var(--theme-color-surface);
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    padding: 20px;
    margin-bottom: 16px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  }
  .card h2 {
    margin: 0 0 16px;
    font-size: 16px;
    font-weight: 600;
    color: var(--theme-color-text-primary);
  }
  .muted {
    margin: 0 0 12px;
    font-size: 14px;
    color: var(--theme-color-text-muted);
  }
  .mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 13px;
    color: var(--theme-color-text-primary);
    word-break: break-all;
  }
  .info-grid {
    display: grid;
    grid-template-columns: max-content 1fr;
    gap: 8px 16px;
    align-items: baseline;
  }
  .info-grid dt {
    font-size: 14px;
    font-weight: 500;
    color: var(--theme-color-text-secondary);
  }
  .info-grid dd {
    margin: 0;
    font-size: 14px;
    color: var(--theme-color-text-primary);
  }
  form-field {
    display: block;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
  .toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    padding: 12px 0;
    border-bottom: 1px solid var(--theme-color-border);
  }
  .toggle-row:last-of-type {
    border-bottom: none;
  }
  .toggle-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .toggle-label {
    font-weight: 500;
    color: var(--theme-color-text-primary);
  }
  .toggle-text .muted {
    margin: 0;
    font-size: 13px;
  }
  .warning {
    margin: 0 0 12px;
    padding: 10px 12px;
    border: 1px solid var(--theme-color-warning);
    border-radius: 6px;
    font-size: 13px;
    color: var(--theme-color-text-primary);
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
    transition: background-color 0.2s ease;
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
    transition: transform 0.2s ease;
  }
  .switch input:checked + .slider {
    background: var(--theme-color-primary);
  }
  .switch input:checked + .slider::before {
    transform: translateX(18px);
  }
  .switch input:disabled + .slider {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .image-row {
    display: flex;
    align-items: center;
    gap: 16px;
    margin-bottom: 12px;
  }
  .image-preview {
    width: 96px;
    height: 96px;
    border: 1px solid var(--theme-color-border);
    border-radius: 8px;
    object-fit: contain;
    background: var(--theme-color-background);
  }
  .image-placeholder {
    width: 96px;
    height: 96px;
    border: 1px dashed var(--theme-color-border);
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    color: var(--theme-color-text-muted);
    text-align: center;
  }
  .primary-btn,
  .secondary-btn,
  .danger-btn {
    padding: 9px 16px;
    border: none;
    border-radius: 6px;
    font: inherit;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }
  .primary-btn {
    background: var(--theme-color-primary);
    color: var(--theme-color-surface);
  }
  .primary-btn:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }
  .primary-btn:active:not(:disabled) {
    background: var(--theme-color-primary-active);
  }
  .secondary-btn {
    background: transparent;
    color: var(--theme-color-text-primary);
    border: 1px solid var(--theme-color-border);
  }
  .secondary-btn:hover:not(:disabled) {
    background: var(--theme-color-background);
  }
  .danger-btn {
    background: var(--theme-color-error);
    color: var(--theme-color-surface);
  }
  .danger-btn:hover:not(:disabled) {
    filter: brightness(0.9);
  }
  .primary-btn:disabled,
  .secondary-btn:disabled,
  .danger-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
