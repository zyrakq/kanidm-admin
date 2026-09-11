// Mobile language picker: slide-up bottom sheet (velora pattern) used
// by the session drawer's Language row. Props: open; events: close,
// locale-selected (after setLocale resolves).

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { LocaleController } from '../controllers/locale.controller';
import { localizationService } from '../services/localization.service';
import { LOCALE_METADATA } from '../data/locale-metadata';
import { localeBottomSheetStyles } from './locale-bottom-sheet.styles';
import type { LocaleCode, LocaleMetadata } from '../types/localization.types';
import '@/shared/components/ui-icon';

@customElement('locale-bottom-sheet')
@localized()
export class LocaleBottomSheet extends LitElement {
  /** Slide the sheet in/out. */
  @property({ type: Boolean }) open = false;

  private locale = new LocaleController(this);

  @state() private locales: LocaleMetadata[] = [];

  connectedCallback(): void {
    super.connectedCallback();
    this.locales = localizationService
      .getAvailableLocales()
      .map((code) => LOCALE_METADATA[code]);
  }

  protected updated(changed: Map<string, unknown>): void {
    if (changed.has('open')) {
      if (this.open) {
        document.addEventListener('keydown', this.handleKeyDown);
      } else {
        document.removeEventListener('keydown', this.handleKeyDown);
      }
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape') {
      this.emitClose();
    }
  };

  private emitClose(): void {
    this.dispatchEvent(
      new CustomEvent('close', { bubbles: true, composed: true })
    );
  }

  private async selectLocale(code: LocaleCode): Promise<void> {
    try {
      await localizationService.setLocale(code);
    } catch (error) {
      console.error('Failed to switch locale:', error);
    }
    this.dispatchEvent(
      new CustomEvent('locale-selected', {
        detail: { locale: code },
        bubbles: true,
        composed: true,
      })
    );
    this.emitClose();
  }

  render() {
    const openClass = this.open ? 'open' : '';
    return html`
      <div
        class="sheet-backdrop ${openClass}"
        @click=${this.emitClose}
        aria-hidden="true"
      ></div>
      <div
        class="sheet-panel ${openClass}"
        role="dialog"
        aria-modal="true"
        aria-label=${msg('Select language')}
      >
        <div class="sheet-handle" aria-hidden="true"></div>
        <div class="sheet-header">${msg('Select language')}</div>
        <div class="sheet-list" role="listbox">
          ${this.locales.map(
            (locale) => {
              const isActive = locale.code === this.locale.locale;
              return html`
                <button
                  class="sheet-item ${isActive ? 'active' : ''}"
                  type="button"
                  role="option"
                  aria-selected=${isActive ? 'true' : 'false'}
                  @click=${() => void this.selectLocale(locale.code)}
                >
                  <span class="sheet-flag">${locale.flag}</span>
                  <span class="sheet-name">${locale.name}</span>
                  ${isActive
                    ? html`<ui-icon
                        name="check"
                        size="16"
                        class="sheet-check"
                      ></ui-icon>`
                    : nothing}
                </button>
              `;
            }
          )}
        </div>
      </div>
    `;
  }

  static styles = localeBottomSheetStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'locale-bottom-sheet': LocaleBottomSheet;
  }
}
