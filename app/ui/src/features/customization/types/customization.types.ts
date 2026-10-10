// Customization API contract — mirrors the backend manifest DTO.

/** Image override slots (logo/favicon). Theme variants live in `theme`. */
export type CustomizationSlot =
  | 'logo-light'
  | 'logo-dark'
  | 'favicon-light'
  | 'favicon-dark';

/** Theme mode addressed by the selection endpoint and serve URLs. */
export type ThemeMode = 'light' | 'dark';

/** Where the effective variant comes from. */
export type ThemeSource = 'selection' | 'config' | 'builtin';

export interface CustomizationSlotEntry {
  present: boolean;
  content_type: string | null;
  updated_at: number | null;
}

/** Per-mode theme info from the manifest. */
export interface ThemeModeInfo {
  /** Effective variant file name, or null for the built-in default. */
  selected: string | null;
  /** Config/env-set deployment default (may name a missing file). */
  config_selected: string | null;
  source: ThemeSource;
}

export interface ThemeManifest {
  /** Sorted discovered variant file names (auto-discovery). */
  available: string[];
  light: ThemeModeInfo;
  dark: ThemeModeInfo;
}

export interface CustomizationManifest {
  /** Max mtime across slots/variants/selection ('0' when empty) — cache-buster. */
  version: string;
  slots: Record<CustomizationSlot, CustomizationSlotEntry>;
  theme: ThemeManifest;
}

export const CUSTOMIZATION_SLOTS: CustomizationSlot[] = [
  'logo-light',
  'logo-dark',
  'favicon-light',
  'favicon-dark',
];

export const THEME_MODES: ThemeMode[] = ['light', 'dark'];
