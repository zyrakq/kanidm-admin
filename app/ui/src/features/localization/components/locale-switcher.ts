import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { LocaleController } from '../controllers/locale.controller';
import { localizationService } from '../services/localization.service';
import { LOCALE_METADATA } from '../data/locale-metadata';
import { localeSwitcherStyles } from './locale-switcher.styles';
import type { LocaleCode, LocaleMetadata } from '../types/localization.types';

@customElement('locale-switcher')
export class LocaleSwitcher extends LitElement {
  private locale = new LocaleController(this);

  @state() private _isOpen = false;

  private get _currentLocaleData(): LocaleMetadata {
    return LOCALE_METADATA[this.locale.locale];
  }

  private get _availableLocales(): LocaleMetadata[] {
    return localizationService
      .getAvailableLocales()
      .map((code) => LOCALE_METADATA[code]);
  }

  render() {
    return html`
      <div class="locale-switcher">
        <button
          class="trigger"
          @click=${this._toggleDropdown}
          aria-label=${msg('Change language')}
        >
          <span class="flag">${this._currentLocaleData.flag}</span>
          <span class="name">${this._currentLocaleData.name}</span>
          <span class="arrow ${this._isOpen ? 'open' : ''}">▼</span>
        </button>

        ${this._isOpen ? this._renderDropdown() : null}
      </div>
    `;
  }

  private _renderDropdown() {
    return html`
      <div class="dropdown" @click=${(e: Event) => e.stopPropagation()}>
        <div class="locale-list">
          ${this._availableLocales.map((locale) =>
            this._renderLocaleItem(locale)
          )}
        </div>
      </div>
    `;
  }

  private _renderLocaleItem(locale: LocaleMetadata) {
    const isActive = locale.code === this.locale.locale;

    return html`
      <button
        class="locale-item ${isActive ? 'active' : ''}"
        @click=${() => this._selectLocale(locale.code)}
      >
        <span class="flag">${locale.flag}</span>
        <span class="name">${locale.name}</span>
        ${isActive ? html`<span class="checkmark">✓</span>` : null}
      </button>
    `;
  }

  private _toggleDropdown(e: Event) {
    e.stopPropagation();
    this._isOpen = !this._isOpen;
  }

  private async _selectLocale(code: LocaleCode) {
    try {
      await localizationService.setLocale(code);
      this._isOpen = false;
    } catch (error) {
      console.error('Failed to switch locale:', error);
    }
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('click', this._handleOutsideClick);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('click', this._handleOutsideClick);
  }

  private _handleOutsideClick = () => {
    if (this._isOpen) {
      this._isOpen = false;
    }
  };

  static styles = localeSwitcherStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'locale-switcher': LocaleSwitcher;
  }
}
