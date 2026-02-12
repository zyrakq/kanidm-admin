# Theme Feature

Portable, zero-dependency theme management for Lit-based web applications.

## Features

- Light/Dark theme support
- System preference detection
- localStorage persistence
- Anti-FART (no flash on page load)
- Reactive Controllers for Lit
- CSS Custom Properties
- Full TypeScript typing
- Zero external dependencies
- Dynamic favicon management with theme synchronization
- PWA manifest support with multi-resolution icons

## Quick Start

### 1. Import CSS variables

```css
/* Your main CSS file */
@import '@/features/theme/styles/theme-variables.css';
```

### 2. Add anti-FART script

Add this inline script to your HTML `<head>` before any other scripts:

```html
<head>
  <script>
    (function(){var e=localStorage.getItem("kanidm-theme"),t;if(e==="light"||e==="dark"){t=e}else if(window.matchMedia("(prefers-color-scheme: dark)").matches){t="dark"}else{t="light"}document.documentElement.setAttribute("theme",t)})();
  </script>
</head>
```

### 3. Use in components

```typescript
import { themeService, ThemeToggler } from '@/features/theme';

// In your header
<theme-toggler></theme-toggler>

// Programmatic usage
themeService.setTheme('dark');
themeService.toggleTheme();
```

### 4. Reactive components

```typescript
import { LitElement, html } from 'lit';
import { ThemeController } from '@/features/theme';

customElements.define('my-component', class extends LitElement {
  private theme = new ThemeController(this);

  render() {
    return html`
      <div class="card">
        Current theme: ${this.theme.theme}
      </div>
    `;
  }
});
```

### 5. Favicon setup (optional)

For automatic favicon switching based on theme with PWA support:

```bash
# Generate PNG icons from SVG using Inkscape
inkscape favicon-light.svg -w 180 -h 180 -o favicons/apple-light.png
inkscape favicon-light.svg -w 192 -h 192 -o favicons/192-light.png
inkscape favicon-light.svg -w 512 -h 512 -o favicons/512-light.png

inkscape favicon-dark.svg -w 180 -h 180 -o favicons/apple-dark.png
inkscape favicon-dark.svg -w 192 -h 192 -o favicons/192-dark.png
inkscape favicon-dark.svg -w 512 -h 512 -o favicons/512-dark.png

# Generate ICO files using ImageMagick
convert favicons/32-light.png favicon-light.ico
convert favicons/32-dark.png favicon-dark.ico
```

The FaviconService automatically initializes when imported and syncs with theme changes.

## Configuration

```typescript
import { ThemeService } from '@/features/theme';

const themeService = ThemeService.getInstance({
  defaultTheme: 'dark',
  useSystemPreference: true,
  storage: {
    key: 'my-app-theme',
    enabled: true,
  },
});
```

## CSS Variables

| Variable | Light | Dark |
|----------|-------|------|
| `--theme-color-primary` | #ff6b35 | #ff6b35 |
| `--theme-color-background` | #f9fafb | #111827 |
| `--theme-color-surface` | #ffffff | #1f2937 |
| `--theme-color-text-primary` | #1f2937 | #f9fafb |
| `--theme-color-border` | #e5e7eb | #374151 |

## Porting to Other Projects

1. Copy `features/theme/` folder to your project
2. Import CSS variables or copy to your stylesheet
3. Add anti-FART script to HTML
4. Update path aliases in imports (if needed)

## API Reference

### themeService

```typescript
// Get current theme
const theme = themeService.getTheme();

// Set theme
themeService.setTheme('dark');

// Toggle theme
themeService.toggleTheme();

// Subscribe to changes
const unsubscribe = themeService.subscribe((theme) => {
  console.log('Theme changed:', theme);
});

// Reset to system/default
themeService.reset();
```

### ThemeController

```typescript
import { ThemeController } from '@/features/theme';

class MyComponent extends LitElement {
  private theme = new ThemeController(this);

  render() {
    return html`Theme: ${this.theme.theme}`;
  }
}
```

### faviconService

```typescript
import { faviconService } from '@/features/theme';

// Service auto-initializes on first import
// Favicon changes automatically when themeService changes

// Get current favicon path for a specific type
const iconPath = faviconService.getFaviconPath('svg');
```

## License

MIT (or your project license)
