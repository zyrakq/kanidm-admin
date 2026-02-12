# Localization Feature

Runtime i18n/l10n support for Lit-based web applications using @lit/localize.

## Features

- Runtime locale switching (no page reload)
- XLIFF format for translations (Weblate, Crowdin compatible)
- Automatic re-render on locale change
- localStorage persistence
- Cross-tab synchronization
- Browser locale detection
- Simple dropdown locale switcher component
- Reactive controller for Lit components

## Supported Locales

| Code | Name (Native) | Name (English) | Flag |
|------|---------------|----------------|------|
| en | English | English | 🇬🇧 |
| ru | Русский | Russian | 🇷🇺 |
| es | Español | Spanish | 🇪🇸 |
| zh-Hans | 简体中文 | Chinese (Simplified) | 🇨🇳 |

## Quick Start

### 1. Wrap strings in msg()

```typescript
import { msg } from '@lit/localize';

render() {
  return html`<h1>${msg('Welcome to Kanidm')}</h1>`;
}
```

### 2. Add @localized() decorator

```typescript
import { localized } from '@/features/localization';

@customElement('my-component')
@localized()
class MyComponent extends LitElement {
  render() {
    return html`<h1>${msg('Hello World')}</h1>`;
  }
}
```

### 3. Initialize in app-component

```typescript
import { localizationService } from '@/features/localization';

constructor() {
  super();
  localizationService.init();
}
```

### 4. Add locale switcher to header

```typescript
import '@/features/localization/components/locale-switcher';

// In render:
html`<locale-switcher></locale-switcher>`;
```

## Translation Workflow

### Extract messages

```bash
bun i18n:extract
```

Creates/updates XLIFF files in `xliff/` directory.

### Add translations

Edit XLIFF files, adding `<target>` elements:

```xml
<trans-unit id="s8a4d6da58d9acb76">
  <source>Welcome to Kanidm</source>
  <target>Добро пожаловать в Kanidm</target>
</trans-unit>
```

### Build translations

```bash
bun i18n:build
```

Generates TypeScript modules in `src/features/localization/generated/locales/`.

## Adding New Strings

1. Wrap string in `msg()` in component
2. Run `bun i18n:extract`
3. Add translations to XLIFF files
4. Run `bun i18n:build`
5. Rebuild application

## Adding New Locale

1. Update `lit-localize.json`:
```json
{
  "targetLocales": ["ru", "es", "zh-Hans", "fr"]
}
```

2. Add metadata to `src/features/localization/data/locale-metadata.ts`:
```typescript
fr: {
  code: 'fr',
  name: 'Français',
  nameEn: 'French',
  flag: '🇫🇷',
  direction: 'ltr',
}
```

3. Create `xliff/fr.xlf`
4. Run `bun i18n:extract` then `bun i18n:build`

## API Reference

### LocalizationService

```typescript
import { localizationService } from '@/features/localization';

// Initialize (call once in app-component constructor)
localizationService.init();

// Get current locale
const current = localizationService.getLocale();

// Switch locale
await localizationService.setLocale('ru');

// Get available locales
const locales = localizationService.getAvailableLocales();

// Detect browser preference
const detected = localizationService.detectBrowserLocale();
```

### LocaleController

```typescript
import { LocaleController } from '@/features/localization';

class MyComponent extends LitElement {
  private locale = new LocaleController(this);

  render() {
    return html`Current: ${this.locale.locale}`;
  }
}
```

### @localized() Decorator

```typescript
import { localized } from '@/features/localization';

@customElement('my-element')
@localized()
class MyElement extends LitElement {
  render() {
    return html`${msg('Hello')}`;
  }
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `bun i18n:extract` | Extract messages to XLIFF files |
| `bun i18n:build` | Build translations from XLIFF |

## Configuration

Edit `lit-localize.json`:

```json
{
  "sourceLocale": "en",
  "targetLocales": ["ru", "es", "zh-Hans"],
  "tsConfig": "./tsconfig.json",
  "output": {
    "mode": "runtime",
    "outputDir": "./src/features/localization/generated/locales",
    "localeCodesModule": "./src/features/localization/generated/locale-codes.ts"
  },
  "interchange": {
    "format": "xliff",
    "xliffDir": "./xliff/"
  }
}
```

## Porting to Other Projects

1. Copy `features/localization/` folder
2. Install dependencies: `bun add @lit/localize @lit/localize-tools`
3. Copy `lit-localize.json` and update paths
4. Add scripts to `package.json`
5. Update `tsconfig.json` and `vite.config.ts` with path alias
6. Follow Quick Start guide above
