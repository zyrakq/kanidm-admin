// Labeled form field wrapping input / select / textarea with a shared
// .field/.label/.input look (extracted once from login-form /
// reauth-modal) and an error message slot.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import './ui-icon';

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

  @state() private open = false;
  @state() private activeIndex = -1;
  @state() private filter = '';
  /** Viewport-space placement for the fixed-position combobox listbox. */
  @state()
  private listboxPos: {
    left: number;
    top?: number;
    bottom?: number;
    width: number;
    maxHeight: number;
  } | null = null;

  private get listboxId(): string {
    return (this.fieldId || 'combobox') + '-listbox';
  }

  private get selectedLabel(): string {
    return this.options.find((o) => o.value === this.value)?.label ?? '';
  }

  private get filteredOptions() {
    return this.options.filter((o) => o.label.toLowerCase().includes(this.filter.toLowerCase()));
  }

  private openCombobox(): void {
    if (this.open) return;
    this.filter = '';
    this.activeIndex = -1;
    this.updateListboxPosition();
    this.open = true;
    document.addEventListener('click', this.onDocClick);
    window.addEventListener('scroll', this.onReposition, true);
    window.addEventListener('resize', this.onReposition);
  }

  private closeCombobox(): void {
    this.open = false;
    this.filter = '';
    this.activeIndex = -1;
    document.removeEventListener('click', this.onDocClick);
    window.removeEventListener('scroll', this.onReposition, true);
    window.removeEventListener('resize', this.onReposition);
  }

  // The listbox is position:fixed so it escapes clipping ancestors
  // (e.g. ui-card's overflow:hidden); re-anchor it while scrolling.
  private onReposition = (): void => {
    if (this.open) this.updateListboxPosition();
  };

  private updateListboxPosition(): void {
    const anchor = this.renderRoot.querySelector<HTMLElement>('.combobox');
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const gap = 4;
    const margin = 8;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    // Flip upward when there is not enough room below and more room above.
    const dropUp = spaceBelow < 160 && spaceAbove > spaceBelow;
    const maxHeight = Math.max(60, Math.min(240, (dropUp ? spaceAbove : spaceBelow) - gap));
    this.listboxPos = dropUp
      ? {
          left: rect.left,
          bottom: window.innerHeight - rect.top + gap,
          width: rect.width,
          maxHeight,
        }
      : { left: rect.left, top: rect.bottom + gap, width: rect.width, maxHeight };
  }

  private toggleCombobox(): void {
    if (this.open) {
      this.closeCombobox();
    } else {
      this.openCombobox();
    }
  }

  private onDocClick = (e: MouseEvent): void => {
    if (!e.composedPath().includes(this)) this.closeCombobox();
  };

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.onDocClick);
    window.removeEventListener('scroll', this.onReposition, true);
    window.removeEventListener('resize', this.onReposition);
  }

  private handleComboboxInput(e: Event): void {
    this.filter = (e.target as HTMLInputElement).value;
    this.activeIndex = -1;
    if (!this.open) this.openCombobox();
  }

  private selectOption(index: number): void {
    const opt = this.filteredOptions[index];
    this.value = opt.value;
    this.closeCombobox();
    this.dispatchEvent(
      new CustomEvent('field-input', {
        detail: { value: this.value },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleComboboxKeyDown(e: KeyboardEvent): void {
    if (e.key === 'ArrowDown') {
      e.stopPropagation();
      if (!this.open) {
        this.openCombobox();
      } else {
        this.activeIndex = Math.min(this.activeIndex + 1, this.filteredOptions.length - 1);
      }
    } else if (e.key === 'ArrowUp') {
      e.stopPropagation();
      this.activeIndex = Math.max(this.activeIndex - 1, 0);
    } else if (e.key === 'Enter') {
      e.stopPropagation();
      if (this.open && this.activeIndex >= 0) {
        e.preventDefault();
        this.selectOption(this.activeIndex);
      } else if (this.open) {
        this.closeCombobox();
      }
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      this.closeCombobox();
    } else if (e.key === 'Tab') {
      e.stopPropagation();
      this.closeCombobox();
    }
  }

  private renderListbox() {
    const filtered = this.filteredOptions;
    const pos = this.listboxPos;
    const style = pos
      ? `left:${pos.left}px;width:${pos.width}px;max-height:${pos.maxHeight}px;` +
        (pos.top !== undefined ? `top:${pos.top}px;` : `bottom:${pos.bottom}px;`)
      : '';
    return html`
      <div class="listbox" role="listbox" id=${this.listboxId} style=${style}>
        ${filtered.length === 0
          ? html`<div class="listbox-empty">${msg('No results')}</div>`
          : filtered.map(
              (option, i) => html`
                <div
                  class=${'listbox-option' + (i === this.activeIndex ? ' active' : '')}
                  role="option"
                  id=${this.listboxId + '-opt-' + i}
                  aria-selected=${option.value === this.value ? 'true' : 'false'}
                  @click=${() => this.selectOption(i)}
                >
                  ${option.label}
                </div>
              `
            )}
      </div>
    `;
  }

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
    if (this.type === 'combobox') {
      control = html`
        <div class="combobox">
          <input
            id=${this.fieldId}
            class="input combobox-input"
            role="combobox"
            .value=${this.open ? this.filter : this.selectedLabel}
            placeholder=${this.placeholder}
            ?disabled=${this.disabled}
            ?required=${this.required}
            aria-expanded=${this.open}
            aria-controls=${this.listboxId}
            aria-activedescendant=${this.activeIndex >= 0 ? this.listboxId + '-opt-' + this.activeIndex : ''}
            aria-autocomplete="list"
            autocomplete="off"
            @input=${this.handleComboboxInput}
            @keydown=${this.handleComboboxKeyDown}
            @click=${() => this.openCombobox()}
          />
          <button
            class="chevron-btn"
            type="button"
            tabindex="-1"
            aria-label=${msg('Toggle options')}
            ?disabled=${this.disabled}
            @click=${() => this.toggleCombobox()}
          >
            <ui-icon name=${this.open ? 'chevron-up' : 'chevron-down'} size="16"></ui-icon>
          </button>
          ${this.open ? this.renderListbox() : nothing}
        </div>
      `;
    } else if (this.type === 'select') {
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
      position: relative;
      margin-bottom: var(--field-margin, 14px);
    }
    .label {
      font-size: 14px;
      font-weight: 500;
      color: var(--theme-color-text-primary);
    }
    .input {
      padding: 9px 12px;
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-md);
      font: inherit;
      color: var(--theme-color-text-primary);
      background: var(--theme-color-surface-sunken);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.08);
      transition:
        border-color var(--theme-duration) var(--theme-ease),
        box-shadow var(--theme-duration) var(--theme-ease),
        background-color var(--theme-duration) var(--theme-ease);
      width: 100%;
      box-sizing: border-box;
    }
    .input::placeholder {
      color: var(--theme-color-text-muted);
    }
    .input:hover:not(:disabled):not(:focus) {
      border-color: var(--theme-color-border-strong);
    }
    .input:focus {
      outline: none;
      border-color: var(--theme-color-primary);
      background: var(--theme-color-surface);
      box-shadow: var(--theme-focus-ring);
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
    .input[type='number'] {
      appearance: textfield;
      -moz-appearance: textfield;
    }
    .input[type='number']::-webkit-inner-spin-button,
    .input[type='number']::-webkit-outer-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    .combobox {
      position: relative;
    }
    .combobox-input {
      padding-right: 40px;
    }
    .chevron-btn {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: none;
      border: none;
      padding: 4px;
      cursor: pointer;
      color: var(--theme-color-text-muted);
    }
    .chevron-btn:hover {
      color: var(--theme-color-text-primary);
    }
    .listbox {
      position: fixed;
      background: var(--theme-color-surface-elevated);
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-md);
      box-shadow: var(--theme-elevation-3), var(--theme-highlight);
      overflow-y: auto;
      padding: 4px;
      z-index: 900;
      animation: listbox-in var(--theme-duration) var(--theme-ease);
    }
    @keyframes listbox-in {
      from {
        opacity: 0;
        transform: translateY(-4px);
      }
    }
    .listbox-option {
      padding: 8px 10px;
      font-size: 14px;
      cursor: pointer;
      border-radius: var(--theme-radius-sm);
      color: var(--theme-color-text-primary);
    }
    .listbox-option:hover,
    .listbox-option.active {
      background: var(--theme-color-surface-hover);
    }
    .listbox-option[aria-selected='true'] {
      color: var(--theme-color-primary);
      background: var(--theme-color-primary-soft);
    }
    .listbox-empty {
      padding: 9px 12px;
      font-size: 13px;
      color: var(--theme-color-text-muted);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'form-field': FormField;
  }
}
