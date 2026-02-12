/**
 * Public API for theme feature
 * Portable, zero-dependency theme management for Lit-based web applications
 */

// Components
export { ThemeToggler } from './components/theme-toggler';

// Services
export { themeService, ThemeService } from './services/theme.service';
export { faviconService, FaviconService } from './services/favicon.service';

// Controllers
export { ThemeController } from './controllers/theme.controller';

// Utils
export { preventFART, generatePreventFARTScript } from './utils/prevent-fart';

// Types
export type {
  Theme,
  ThemeMode,
  ThemeConfig,
  ThemeStorage,
  PreventFARTOptions,
} from './types/theme.types';

// Constants
export {
  THEME_ATTRIBUTE,
  THEME_STORAGE_KEY,
  DEFAULT_CONFIG,
} from './types/theme.types';
