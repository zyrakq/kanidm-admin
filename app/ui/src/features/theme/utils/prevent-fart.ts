import {
  THEME_STORAGE_KEY,
  THEME_ATTRIBUTE,
  type Theme,
} from '../types/theme.types';

/**
 * Options for preventFART function
 */
export interface PreventFARTOptions {
  /**
   * localStorage key to read theme from
   * @default 'app-theme'
   */
  storageKey?: string;

  /**
   * HTML attribute to set theme on
   * @default 'theme'
   */
  attribute?: string;

  /**
   * Use system preference as fallback
   * @default true
   */
  useSystemPreference?: boolean;

  /**
   * Default theme if no preference found
   * @default 'light'
   */
  defaultTheme?: Theme;
}

/**
 * Prevent FART (Flash of inAccurate coloR Theme)
 *
 * This function must be called BEFORE any rendering occurs.
 * Inject it as an inline script in <head> or use it in a
 * blocking script.
 *
 * @example
 * ```html
 * <head>
 *   <script>
 *     (function() {
 *       var stored = localStorage.getItem('app-theme');
 *       var theme;
 *       if (stored === 'light' || stored === 'dark') {
 *         theme = stored;
 *       } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
 *         theme = 'dark';
 *       } else {
 *         theme = 'light';
 *       }
 *       document.documentElement.setAttribute('theme', theme);
 *     })();
 *   </script>
 * </head>
 * ```
 *
 * @param options - Configuration options
 */
export function preventFART(options: PreventFARTOptions = {}): void {
  const {
    storageKey = THEME_STORAGE_KEY,
    attribute = THEME_ATTRIBUTE,
    useSystemPreference = true,
    defaultTheme = 'light',
  } = options;

  let theme: Theme;

  // Try localStorage first
  const stored = localStorage.getItem(storageKey) as Theme | null;

  if (stored && (stored === 'light' || stored === 'dark')) {
    theme = stored;
  } else if (useSystemPreference) {
    // Fallback to system preference
    theme = window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  } else {
    // Fallback to default
    theme = defaultTheme;
  }

  document.documentElement.setAttribute(attribute, theme);
}

/**
 * Generate minified inline script string for preventFART
 * Use this to inject into HTML at build time
 *
 * @example
 * ```ts
 * const script = generatePreventFARTScript({ storageKey: 'my-theme' });
 * html = html.replace('</head>', `<script>${script}</script></head>`);
 * ```
 *
 * @param options - Configuration options
 * @returns Minified JavaScript code
 */
export function generatePreventFARTScript(
  options: PreventFARTOptions = {}
): string {
  const {
    storageKey = THEME_STORAGE_KEY,
    attribute = THEME_ATTRIBUTE,
    useSystemPreference = true,
    defaultTheme = 'light',
  } = options;

  return `(function(){var e=localStorage.getItem("${storageKey}"),t;if(e==="light"||e==="dark"){t=e}${
    useSystemPreference
      ? `else if(window.matchMedia("(prefers-color-scheme: dark)").matches){t="dark"}`
      : ''
  }else{t="${defaultTheme}"}document.documentElement.setAttribute("${attribute}",t)})();`;
}
