// Public API — only export from here.
// Side effect: injects the theme override <link> tags (after the bundle).
import './services/theme-override-loader.ts';
export {
  CustomizationService,
  customizationService,
} from './services/customization.service.ts';
export type {
  CustomizationSlot,
  CustomizationSlotEntry,
  CustomizationManifest,
  ThemeMode,
  ThemeModeInfo,
  ThemeSource,
  ThemeManifest,
} from './types/customization.types.ts';
export {
  CUSTOMIZATION_SLOTS,
  THEME_MODES,
} from './types/customization.types.ts';
