import { configureLocalization } from '@lit/localize';
import {
  sourceLocale,
  targetLocales,
  allLocales,
} from '../generated/locale-codes';
import type { LocaleCode } from '../types/localization.types';
import { DEFAULT_LOCALE, STORAGE_KEY } from '../data/locale-metadata';

class LocalizationService {
  private static instance: LocalizationService | null = null;
  private initialized = false;
  private _getLocale!: () => string;
  private _setLocale!: (locale: string) => Promise<void>;

  private constructor() {}

  static getInstance(): LocalizationService {
    if (!LocalizationService.instance) {
      LocalizationService.instance = new LocalizationService();
    }
    return LocalizationService.instance;
  }

  init(): void {
    if (this.initialized) return;

    const { getLocale, setLocale } = configureLocalization({
      sourceLocale,
      targetLocales,
      loadLocale: (locale: string) =>
        import(`../generated/locales/${locale}.ts`),
    });

    this._getLocale = getLocale;
    this._setLocale = setLocale;

    window.addEventListener('storage', this._handleStorageChange);
    window.addEventListener(
      'lit-localize-status',
      this._handleStatusChange as EventListener
    );

    this.initialized = true;

    const savedLocale = this._getSavedLocale();
    if (savedLocale && savedLocale !== sourceLocale) {
      this.setLocale(savedLocale as LocaleCode).catch(console.error);
    }
  }

  getLocale(): LocaleCode {
    return this._getLocale() as LocaleCode;
  }

  async setLocale(locale: LocaleCode): Promise<void> {
    if (!allLocales.includes(locale)) {
      throw new Error(`Unsupported locale: ${locale}`);
    }

    await this._setLocale(locale);
    this._saveLocale(locale);

    window.dispatchEvent(
      new CustomEvent('kanidm-locale-change', {
        detail: {
          oldLocale: this._getLocale(),
          newLocale: locale,
        },
      })
    );
  }

  getAvailableLocales(): LocaleCode[] {
    return [...allLocales] as LocaleCode[];
  }

  detectBrowserLocale(): LocaleCode {
    const browserLang =
      navigator.language ||
      (navigator as unknown as { userLanguage?: string }).userLanguage ||
      '';

    if (allLocales.includes(browserLang as any)) {
      return browserLang as LocaleCode;
    }

    const langCode = browserLang.split('-')[0] || 'en';
    const match = allLocales.find((locale) => locale.startsWith(langCode));

    return (match as LocaleCode) || DEFAULT_LOCALE;
  }

  private _getSavedLocale(): LocaleCode | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved as LocaleCode | null;
    } catch {
      return null;
    }
  }

  private _saveLocale(locale: LocaleCode): void {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch (error) {
      console.warn('Failed to save locale to localStorage:', error);
    }
  }

  private _handleStorageChange = (event: StorageEvent): void => {
    if (event.key === STORAGE_KEY && event.newValue) {
      const newLocale = event.newValue as LocaleCode;
      if (newLocale !== this.getLocale()) {
        this.setLocale(newLocale).catch(console.error);
      }
    }
  };

  private _handleStatusChange = (event: CustomEvent): void => {
    const { status } = event.detail;
    console.debug('[Localization] Status:', status, event.detail);
  };

  destroy(): void {
    window.removeEventListener('storage', this._handleStorageChange);
    window.removeEventListener(
      'lit-localize-status',
      this._handleStatusChange as EventListener
    );
  }
}

export const localizationService = LocalizationService.getInstance();
