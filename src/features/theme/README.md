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

## License

MIT (or your project license)
