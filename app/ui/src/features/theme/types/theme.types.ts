/**
 * Theme management types for Lit-based web applications.
 * Designed to be portable and reusable across projects.
 */

/**
 * Supported theme modes
 * Easily extendable: 'light' | 'dark' | 'high-contrast' | 'custom'
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Alias for backward compatibility
 */
export type Theme = ThemeMode;

/**
 * Theme storage options
 */
export interface ThemeStorage {
  /**
   * localStorage key for storing user preference
   * @default 'app-theme'
   */
  key: string;

  /**
   * Enable/disable localStorage persistence
   * @default true
   */
  enabled: boolean;
}

/**
 * Theme configuration options
 */
export interface ThemeConfig {
  /**
   * Default theme to use if no preference is set
   * @default 'light'
   */
  defaultTheme: ThemeMode;

  /**
   * Use system color-scheme preference as fallback
   * @default true
   */
  useSystemPreference: boolean;

  /**
   * Storage configuration
   */
  storage: ThemeStorage;

  /**
   * HTML attribute name for theme
   * @default 'theme'
   */
  attribute: string;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: ThemeConfig = {
  defaultTheme: 'light',
  useSystemPreference: true,
  storage: {
    key: 'app-theme',
    enabled: true,
  },
  attribute: 'theme',
};

/**
 * Theme attribute name (exported as constant)
 */
export const THEME_ATTRIBUTE = 'theme';

/**
 * Default localStorage key (exported as constant)
 */
export const THEME_STORAGE_KEY = 'app-theme';

// PreventFART options type (re-exported from utils for convenience)
export type { PreventFARTOptions } from '../utils/prevent-fart';
