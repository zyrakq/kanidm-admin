import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { LocaleController } from '../controllers/locale.controller';
import { localizationService } from '../services/localization.service';
import { LOCALE_METADATA } from '../data/locale-metadata';
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

  static styles = css`
    :host {
      display: inline-block;
      position: relative;
    }

    .locale-switcher {
      position: relative;
      display: inline-block;
    }

    .trigger {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.5rem 0.75rem;
      background: var(--theme-color-surface);
      border: 1px solid var(--theme-color-border);
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      color: var(--theme-color-text-primary);
      transition: all 0.2s ease;
    }

    .trigger:hover {
      background: var(--theme-color-background);
      border-color: var(--theme-color-primary);
    }

    .flag {
      font-size: 1.25rem;
      line-height: 1;
    }

    .name {
      color: var(--theme-color-text-primary);
    }

    .arrow {
      font-size: 0.625rem;
      transition: transform 0.2s ease;
      color: var(--theme-color-text-muted);
    }

    .arrow.open {
      transform: rotate(180deg);
    }

    .dropdown {
      position: absolute;
      top: 100%;
      right: 0;
      min-width: 200px;
      background: var(--theme-color-surface);
      border: 1px solid var(--theme-color-border);
      border-radius: 8px;
      box-shadow: var(--theme-shadow-md);
      overflow: visible;
      z-index: 1000;
      margin-top: 0.25rem;
    }

    .locale-list {
      padding: 0.5rem;
    }

    .locale-item {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      width: 100%;
      padding: 0.625rem 0.75rem;
      border: none;
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      text-align: left;
      font-size: 0.875rem;
      color: var(--theme-color-text-primary);
      transition: background-color 0.15s ease;
    }

    .locale-item:hover {
      background: var(--theme-color-background);
    }

    .locale-item.active {
      background: var(--theme-color-primary);
      color: white;
    }

    .locale-item .flag {
      font-size: 1.25rem;
    }

    .locale-item .name {
      flex: 1;
    }

    .checkmark {
      font-size: 1rem;
      font-weight: 700;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'locale-switcher': LocaleSwitcher;
  }
}
