// Read-only monospace value with an inline copy button.
// Emits 'copied' / 'copy-failed' so the host can show its own toast.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import './ui-icon';

@customElement('ui-copy-field')
export class UiCopyField extends LitElement {
  /** Already-localized caption above the value. */
  @property() label = '';
  @property() value = '';
  /** Already-localized aria-label/tooltip of the copy button. */
  @property({ attribute: 'copy-label' }) copyLabel = '';

  @state() private justCopied = false;
  private resetTimer: number | undefined;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.clearTimeout(this.resetTimer);
  }

  private async handleCopy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(this.value);
    } catch {
      this.dispatchEvent(
        new CustomEvent('copy-failed', { bubbles: true, composed: true })
      );
      return;
    }
    this.justCopied = true;
    window.clearTimeout(this.resetTimer);
    this.resetTimer = window.setTimeout(() => (this.justCopied = false), 1500);
    this.dispatchEvent(
      new CustomEvent('copied', { bubbles: true, composed: true })
    );
  }

  render() {
    return html`
      ${this.label ? html`<span class="label">${this.label}</span>` : nothing}
      <div class="field">
        <code class="value">${this.value}</code>
        <button
          class=${'copy' + (this.justCopied ? ' done' : '')}
          type="button"
          title=${this.copyLabel}
          aria-label=${this.copyLabel}
          @click=${this.handleCopy}
        >
          <ui-icon
            name=${this.justCopied ? 'check' : 'copy'}
            size="14"
          ></ui-icon>
        </button>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 6px;
      min-width: 0;
    }
    .label {
      font-size: 12px;
      font-weight: 500;
      color: var(--theme-color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .field {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 6px 6px 12px;
      background: var(--theme-color-surface-sunken);
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-md);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.1);
      transition: border-color var(--theme-duration) var(--theme-ease);
    }
    .field:hover {
      border-color: var(--theme-color-border-strong);
    }
    .value {
      flex: 1;
      min-width: 0;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--theme-color-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .copy {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border: none;
      border-radius: var(--theme-radius-sm);
      background: transparent;
      color: var(--theme-color-text-secondary);
      cursor: pointer;
      transition:
        background-color var(--theme-duration) var(--theme-ease),
        color var(--theme-duration) var(--theme-ease);
    }
    .copy:hover {
      background: var(--theme-color-surface-hover);
      color: var(--theme-color-text-primary);
    }
    .copy:focus-visible {
      outline: none;
      box-shadow: var(--theme-focus-ring);
    }
    .copy.done {
      color: var(--theme-color-success);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-copy-field': UiCopyField;
  }
}
