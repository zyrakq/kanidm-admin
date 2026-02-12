/**
 * Supported locale codes (BCP 47)
 */
export type LocaleCode = 'en' | 'ru' | 'es' | 'zh-Hans';

/**
 * Text direction for locale
 */
export type TextDirection = 'ltr' | 'rtl';

/**
 * Metadata for each supported locale
 */
export interface LocaleMetadata {
  code: LocaleCode;
  name: string;
  nameEn: string;
  flag: string;
  direction: TextDirection;
}

/**
 * Status of locale loading
 */
export type LocaleStatus = 'loading' | 'ready' | 'error';

/**
 * Event detail for locale changes
 */
export interface LocaleChangeEvent {
  oldLocale: LocaleCode;
  newLocale: LocaleCode;
}
