import type { LocaleMetadata, LocaleCode } from '../types/localization.types';

export const LOCALE_METADATA: Record<LocaleCode, LocaleMetadata> = {
  en: {
    code: 'en',
    name: 'English',
    nameEn: 'English',
    flag: '🇬🇧',
    direction: 'ltr',
  },
  ru: {
    code: 'ru',
    name: 'Русский',
    nameEn: 'Russian',
    flag: '🇷🇺',
    direction: 'ltr',
  },
  es: {
    code: 'es',
    name: 'Español',
    nameEn: 'Spanish',
    flag: '🇪🇸',
    direction: 'ltr',
  },
  'zh-Hans': {
    code: 'zh-Hans',
    name: '简体中文',
    nameEn: 'Chinese (Simplified)',
    flag: '🇨🇳',
    direction: 'ltr',
  },
};

export const DEFAULT_LOCALE: LocaleCode = 'en';
export const STORAGE_KEY = 'kanidm-locale';
