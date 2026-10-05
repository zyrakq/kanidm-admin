import { css } from 'lit';

export const systemPageStyles = css`
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
  .card .description {
    margin: 0 0 16px;
    font-size: 14px;
    color: var(--theme-color-text-muted);
  }
  .add-form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 16px;
  }
  .add-form .form-actions {
    display: flex;
    justify-content: flex-end;
  }
  .btn-primary,
  .btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: none;
    border-radius: 6px;
    padding: 8px 14px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s ease, color 0.2s ease;
  }
  .btn-primary {
    background: var(--theme-color-primary);
    color: #ffffff;
  }
  .btn-primary:hover:not(:disabled) {
    background: var(--theme-color-primary-hover);
  }
  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  .btn-secondary {
    background: var(--theme-color-surface);
    color: var(--theme-color-text-primary);
    border: 1px solid var(--theme-color-border);
  }
  .mono {
    font-family: var(--theme-font-mono, monospace);
    font-size: 13px;
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
`;
