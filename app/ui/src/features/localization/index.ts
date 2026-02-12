// Services
export { localizationService } from './services/localization.service';

// Controllers
export { LocaleController, localized } from './controllers/locale.controller';

// Components
export { LocaleSwitcher } from './components/locale-switcher';

// Types
export type {
  LocaleCode,
  LocaleMetadata,
  TextDirection,
  LocaleStatus,
  LocaleChangeEvent,
} from './types/localization.types';

// Data
export { LOCALE_METADATA, DEFAULT_LOCALE } from './data/locale-metadata';

// Re-export @lit/localize functions for convenience
export { msg, str } from '@lit/localize';
