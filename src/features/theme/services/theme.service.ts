import type { Theme, ThemeConfig } from '../types/theme.types';
import { DEFAULT_CONFIG } from '../types/theme.types';

/**
 * Theme management service (Singleton)
 *
 * Features:
 * - localStorage persistence
 * - System preference detection
 * - Observer pattern for reactivity
 * - Zero external dependencies
 *
 * @example
 * ```ts
 * import { themeService } from '@/features/theme';
 *
 * // Get current theme
 * const theme = themeService.getTheme();
 *
 * // Set theme
 * themeService.setTheme('dark');
 *
 * // Toggle theme
 * themeService.toggleTheme();
 *
 * // Subscribe to changes
 * const unsubscribe = themeService.subscribe((theme) => {
 *   console.log('Theme changed:', theme);
 * });
 * ```
 */
export class ThemeService {
  private static instance: ThemeService;
  private theme: Theme;
  private config: ThemeConfig;
  private listeners = new Set<(theme: Theme) => void>();
  private systemMediaQuery?: MediaQueryList;

  private constructor(config: Partial<ThemeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.theme = this.config.defaultTheme;
    this.init();
  }

  /**
   * Get singleton instance
   * @param config - Optional configuration (only applied on first call)
   */
  static getInstance(config?: Partial<ThemeConfig>): ThemeService {
    if (!ThemeService.instance) {
      ThemeService.instance = new ThemeService(config);
    }
    return ThemeService.instance;
  }

  /**
   * Initialize theme service
   */
  private init(): void {
    this.theme = this.resolveInitialTheme();
    this.applyTheme();

    if (this.config.useSystemPreference) {
      this.watchSystemTheme();
    }
  }

  /**
   * Resolve initial theme based on priority:
   * 1. localStorage (if enabled)
   * 2. System preference (if enabled)
   * 3. Default theme
   */
  private resolveInitialTheme(): Theme {
    // 1. Check localStorage
    if (this.config.storage.enabled) {
      const stored = localStorage.getItem(
        this.config.storage.key
      ) as Theme | null;
      if (stored && this.isValidTheme(stored)) {
        return stored;
      }
    }

    // 2. Check system preference
    if (this.config.useSystemPreference) {
      return this.getSystemTheme();
    }

    // 3. Use default
    return this.config.defaultTheme;
  }

  /**
   * Apply theme to DOM
   */
  private applyTheme(): void {
    document.documentElement.setAttribute(this.config.attribute, this.theme);
    this.notifyListeners();
  }

  /**
   * Get system color-scheme preference
   */
  private getSystemTheme(): Theme {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  /**
   * Watch for system theme changes
   */
  private watchSystemTheme(): void {
    this.systemMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    this.systemMediaQuery.addEventListener('change', (e) => {
      // Only sync if user hasn't set explicit preference
      if (!this.hasUserPreference()) {
        this.theme = e.matches ? 'dark' : 'light';
        this.applyTheme();
      }
    });
  }

  /**
   * Check if user has set explicit preference
   */
  private hasUserPreference(): boolean {
    if (!this.config.storage.enabled) return false;
    return localStorage.getItem(this.config.storage.key) !== null;
  }

  /**
   * Validate theme value
   */
  private isValidTheme(value: string): value is Theme {
    return value === 'light' || value === 'dark';
  }

  /**
   * Notify all subscribers
   */
  private notifyListeners(): void {
    this.listeners.forEach((callback) => callback(this.theme));
  }

  // ========== Public API ==========

  /**
   * Get current theme
   */
  getTheme(): Theme {
    return this.theme;
  }

  /**
   * Set theme
   */
  setTheme(theme: Theme): void {
    if (!this.isValidTheme(theme)) {
      console.warn(`Invalid theme: ${theme}. Using default.`);
      return;
    }

    this.theme = theme;

    if (this.config.storage.enabled) {
      localStorage.setItem(this.config.storage.key, theme);
    }

    this.applyTheme();
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    this.setTheme(this.theme === 'light' ? 'dark' : 'light');
  }

  /**
   * Subscribe to theme changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (theme: Theme) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Clear user preference and reset to system/default
   */
  reset(): void {
    if (this.config.storage.enabled) {
      localStorage.removeItem(this.config.storage.key);
    }

    this.theme = this.config.useSystemPreference
      ? this.getSystemTheme()
      : this.config.defaultTheme;

    this.applyTheme();
  }

  /**
   * Get current configuration
   */
  getConfig(): Readonly<ThemeConfig> {
    return { ...this.config };
  }

  /**
   * Cleanup (for testing or special cases)
   */
  destroy(): void {
    this.listeners.clear();
    this.systemMediaQuery = undefined;
  }
}

/**
 * Default theme service instance
 * Ready to use with sensible defaults
 */
export const themeService = ThemeService.getInstance({
  storage: {
    key: 'kanidm-theme',
    enabled: true,
  },
});
