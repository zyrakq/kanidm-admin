/**
 * Favicon management service
 *
 * Features:
 * - Dynamic favicon updates based on theme
 * - Support for ICO, SVG, and Apple Touch Icons
 * - Automatic synchronization with ThemeService
 * - Zero external dependencies
 *
 * @example
 * ```ts
 * import { faviconService } from '@/features/theme';
 *
 * // Service auto-initializes on first import
 * // Favicon changes automatically when themeService changes
 * ```
 */
import { themeService } from './theme.service';

export class FaviconService {
  private static instance: FaviconService | null = null;
  private currentTheme: string;
  private unsubscribe?: () => void;

  private readonly faviconPaths = {
    ico: (theme: string) => `/favicon-${theme}.ico`,
    svg: (theme: string) => `/favicon-${theme}.svg`,
    apple: (theme: string) => `/favicons/apple-${theme}.png`,
  };

  private constructor() {
    this.currentTheme = themeService.getTheme();
    this.init();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): FaviconService {
    if (!FaviconService.instance) {
      FaviconService.instance = new FaviconService();
    }
    return FaviconService.instance;
  }

  /**
   * Initialize favicon management
   */
  private init(): void {
    this.updateFavicons(this.currentTheme);

    // Subscribe to theme changes
    this.unsubscribe = themeService.subscribe((theme) => {
      this.updateFavicons(theme);
    });
  }

  /**
   * Update all favicon links based on theme
   */
  private updateFavicons(theme: string): void {
    this.currentTheme = theme;
    this.updateLink(
      'icon-ico',
      'icon',
      this.faviconPaths.ico(theme),
      'image/x-icon'
    );
    this.updateLink(
      'icon-svg',
      'icon',
      this.faviconPaths.svg(theme),
      'image/svg+xml'
    );
    this.updateLink(
      'apple-touch-icon',
      'apple-touch-icon',
      this.faviconPaths.apple(theme)
    );
  }

  /**
   * Create or update a link element
   */
  private updateLink(
    id: string,
    rel: string,
    href: string,
    type?: string
  ): void {
    let link = document.querySelector<HTMLLinkElement>(`link[id="${id}"]`);

    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = rel;
      if (type) link.type = type;
      document.head.appendChild(link);
    }

    link.href = href;
  }

  /**
   * Get current favicon path for a specific type
   */
  getFaviconPath(type: 'ico' | 'svg' | 'apple'): string {
    return this.faviconPaths[type](this.currentTheme);
  }

  /**
   * Cleanup (for testing or special cases)
   */
  destroy(): void {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = undefined;
    }
  }
}

/**
 * Default favicon service instance
 * Auto-initializes on first access
 */
export const faviconService = FaviconService.getInstance();
