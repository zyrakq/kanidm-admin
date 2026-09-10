// Labeled form field wrapping input / select / textarea with a shared
// .field/.label/.input look (extracted once from login-form /
// reauth-modal) and an error message slot.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized } from '@/features/localization';

@customElement('form-field')
@localized()
export class FormField extends LitElement {
  /** Field label (already localized). */
  @property() label = '';
  /** Id of the inner control (for label association). */
  @property() fieldId = '';
  /** text | password | email | url | number | datetime-local | select | textarea */
  @property() type = 'text';
  @property() value = '';
  @property() placeholder = '';
  @property({ type: Boolean }) disabled = false;
  @property({ type: Boolean }) required = false;
  /** Options for type="select": {value, label}[]. */
  @property({ type: Array })
  options: { value: string; label: string }[] = [];
  @property({ type: Number }) rows = 3;
  /** Already-localized error message; hidden when empty. */
  @property() error = '';
  /** Already-localized hint below the control. */
  @property() hint = '';

  private handleInput(e: Event): void {
    const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    this.value = target.value;
    // Re-emit so parent components using change-tracking can listen.
    this.dispatchEvent(
      new CustomEvent('field-input', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    const label = html`
      <label class="label" for=${this.fieldId}>${this.label}</label>
    `;
    let control;
    if (this.type === 'select') {
      control = html`
        <select
          id=${this.fieldId}
          class="input"
          .value=${this.value}
          ?disabled=${this.disabled}
          ?required=${this.required}
          @input=${this.handleInput}
        >
          ${this.options.map(
            (option) => html`
              <option value=${option.value} ?selected=${option.value === this.value}>
                ${option.label}
              </option>
            `
          )}
        </select>
      `;
    } else if (this.type === 'textarea') {
      control = html`
        <textarea
          id=${this.fieldId}
          class="input"
          .value=${this.value}
          placeholder=${this.placeholder}
          rows=${this.rows}
          ?disabled=${this.disabled}
          ?required=${this.required}
          @input=${this.handleInput}
        ></textarea>
      `;
    } else {
      control = html`
        <input
          id=${this.fieldId}
          class="input"
          type=${this.type}
          .value=${this.value}
          placeholder=${this.placeholder}
          ?disabled=${this.disabled}
          ?required=${this.required}
          @input=${this.handleInput}
        />
      `;
    }
    return html`
      <div class="field">
        ${this.label ? label : nothing}
        ${control}
        ${this.hint && !this.error ? html`<p class="hint">${this.hint}</p>` : nothing}
        ${this.error ? html`<p class="error" role="alert">${this.error}</p>` : nothing}
      </div>
    `;
  }

  static styles = css`
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin-bottom: 14px;
    }
    .label {
      font-size: 14px;
      font-weight: 500;
      color: var(--theme-color-text-primary);
    }
    .input {
      padding: 9px 12px;
      border: 1px solid var(--theme-color-border);
      border-radius: 6px;
      font: inherit;
      color: var(--theme-color-text-primary);
      background: var(--theme-color-surface);
      transition: border-color 0.2s ease;
      width: 100%;
    }
    .input:focus {
      outline: none;
      border-color: var(--theme-color-primary);
    }
    .input:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .hint {
      margin: 0;
      font-size: 12px;
      color: var(--theme-color-text-muted);
    }
    .error {
      margin: 0;
      font-size: 13px;
      color: var(--theme-color-error);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'form-field': FormField;
  }
}
