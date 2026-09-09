# Code Style

## Naming Conventions

### Files

| Pattern | Example |
|---|---|
| Components | `kebab-case.ts` | `auth-status.ts`, `theme-toggler.ts` |
| Services | `<noun>.service.ts` | `auth.service.ts`, `theme.service.ts` |
| Types | `<noun>.types.ts` | `auth.types.ts`, `notification.types.ts` |
| Controllers | `<noun>.controller.ts` | `theme.controller.ts`, `locale.controller.ts` |
| Pages | `<name>-page.ts` | `dashboard-page.ts`, `welcome-page.ts` |
| CSS | `kebab-case.css` | `theme-variables.css` |
| Utilities | `kebab-case.ts` | `prevent-fart.ts`, `locale-metadata.ts` |

### Classes & Types

| Kind | Convention | Example |
|---|---|---|
| Classes | PascalCase + role suffix | `AuthService`, `ThemeController`, `AuthStatus` |
| Interfaces | PascalCase noun | `User`, `AuthState`, `NotificationOptions` |
| Type aliases | PascalCase noun | `Theme`, `NotificationType`, `LocaleCode` |
| Union values | lowercase strings | `'light' \| 'dark'`, `'success' \| 'error'` |

### Functions & Methods

| Pattern | Convention | Example |
|---|---|---|
| Event handlers | `handle` + PascalCase | `handleSignIn()`, `handleToggle()` |
| Data loaders | `load` + PascalCase | `loadAuthState()`, `loadUserData()` |
| State checkers | `is` / `has` / `check` | `isAuthenticated()`, `hasUserPreference()` |
| Getters | `get` + PascalCase | `getAuthState()`, `getTheme()` |
| Lit sub-renderers | `render` + PascalCase | `renderMoonIcon()`, `renderSunIcon()` |

### Variables & Constants

```typescript
// Singleton instances: camelCase (class name, lowercase first)
export const authService = AuthService.getInstance();
export const themeService = ThemeService.getInstance();

// Constants: SCREAMING_SNAKE_CASE
const THEME_STORAGE_KEY = 'kanidm-theme';
const MAX_VISIBLE_NOTIFICATIONS = 4;

// Reactive state: camelCase
@state() private isAuthenticated = false;
@state() private user: User | null = null;

// Private fields: camelCase
private initPromise: Promise<void> | null = null;
private listeners = new Set<(theme: Theme) => void>();
```

### Custom Elements

```typescript
// Tag: kebab-case string
// Class: same words in PascalCase
@customElement('auth-status')
export class AuthStatus extends LitElement { ... }

// Always register in HTMLElementTagNameMap at bottom of file
declare global {
  interface HTMLElementTagNameMap {
    'auth-status': AuthStatus;
  }
}
```

### CSS Classes

- All **kebab-case**, component-scoped inside Lit `css` templates
- Modifiers appended with a dash: `.btn-primary`, `.toast-success`
- No BEM `__` or `--` separators — flat modifier style

```css
.auth-card { ... }
.btn { ... }
.btn-primary { ... }     /* modifier */
.toast { ... }
.toast-success { ... }   /* type modifier */
.toast-clickable { ... } /* state modifier */
```

### CSS Custom Properties

Always prefixed `--theme-`, then category, then name:

```css
--theme-color-primary
--theme-color-background
--theme-color-text-primary
--theme-color-border
--theme-color-success
--theme-shadow-md
```

Never hardcode color values — always use variables from
`@/features/theme/styles/theme-variables.css`.

## File Organization

### Feature Structure

```
features/<name>/
├── components/   # Lit web components only
├── services/     # Business logic, API calls, singletons
├── types/        # TypeScript interfaces and type aliases
├── index.ts      # Public API — only export from here
```

Optional subdirectories when needed: `controllers/`, `utils/`, `data/`, `styles/`.

### Feature `index.ts`

Export only the public API. Include file extensions in import paths:

```typescript
export { AuthStatus } from './components/auth-status.ts';
export { authService } from './services/auth.service.ts';
export type { AuthState, User } from './types/auth.types.ts';
```

### Import Paths

- **Within a feature**: use relative paths
  ```typescript
  import { authService } from '../services/auth.service.ts';
  ```
- **Cross-feature**: use path aliases
  ```typescript
  import { themeService } from '@/features/theme';
  import { notificationService } from '@/features/notifications';
  ```

## Lit Component Patterns

### Standard Component Template

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, state, property } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';

@customElement('my-component')
@localized()
export class MyComponent extends LitElement {
  @property({ type: String }) label = '';
  @state() private loading = false;

  static styles = css`
    :host { display: block; }
  `;

  render() {
    return html`<div>${msg('Hello')}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'my-component': MyComponent;
  }
}
```

### Singleton Service Pattern

```typescript
class MyService {
  private static instance: MyService;

  private constructor() {}

  static getInstance(): MyService {
    if (!MyService.instance) {
      MyService.instance = new MyService();
    }
    return MyService.instance;
  }
}

// Export both class and singleton instance
export const myService = MyService.getInstance();
```

### Reactive Controller Pattern

```typescript
// In a component that needs theme-reactive rendering:
import { ThemeController } from '@/features/theme';

@customElement('my-component')
export class MyComponent extends LitElement {
  private theme = new ThemeController(this);

  render() {
    const isDark = this.theme.theme === 'dark';
    return html`<img src="${isDark ? darkLogo : lightLogo}" />`;
  }
}
```

### Guard Against Double-Init

```typescript
class MyService {
  private initPromise: Promise<void> | null = null;

  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this._doInit();
    return this.initPromise;
  }
}
```

## Localization

Every component with user-visible strings must:

1. Use `@localized()` decorator
2. Wrap all strings in `msg()`

```typescript
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';

@customElement('my-component')
@localized()
export class MyComponent extends LitElement {
  render() {
    return html`<h1>${msg('Welcome')}</h1>`;
  }
}
```

After adding new `msg()` calls:

```bash
bun i18n:extract   # updates xliff/*.xlf
# add translations to xliff files
bun i18n:build     # regenerates generated/locales/*.ts
```

Never edit files in `src/features/localization/generated/` manually.

## Error Handling

- Services dispatch `CustomEvent('notification-add')` on `window` for non-fatal errors
- Components call `notificationService.error(message)` directly for user-facing errors
- Fatal errors are re-thrown after dispatching a notification
- Async errors are caught in `try/catch` with `finally` to reset loading state

```typescript
// Service layer
try {
  await someOperation();
} catch (error) {
  window.dispatchEvent(new CustomEvent('notification-add', {
    detail: { type: 'error', message: 'Operation failed' },
    bubbles: true,
    composed: true,
  }));
  throw error; // re-throw if fatal
}

// Component layer
try {
  this.loading = true;
  await authService.signIn();
} catch (error) {
  notificationService.error('Sign in failed');
} finally {
  this.loading = false;
}
```

## Styling Guidelines

- Use `var(--theme-color-*)` for all colors — never hardcode
- Add theme transitions on interactive elements:
  ```css
  transition: background-color 0.2s ease, color 0.2s ease;
  ```
- Buttons: orange background (`var(--theme-color-primary)`), no shadows, `border-radius: 6px`, `font-weight: 500`
- Cards: surface background, minimal shadow (`var(--theme-shadow-md)`), `border-radius: 8px`
- No gradients on backgrounds, no 3D effects

## TypeScript

- Strict mode enabled (`"strict": true`)
- `noUnusedLocals` and `noUnusedParameters` are errors
- Use `export type` for type-only exports
- Include `.ts` extension in import paths (required by `allowImportingTsExtensions`)
- Target: ES2022; module: ESNext; `experimentalDecorators: true`

## Linting & Formatting

- **ESLint**: `eslint:recommended` + `plugin:lit/recommended` + `plugin:prettier/recommended`
- **Prettier**: semicolons on, single quotes, trailing commas (ES5)
- Run before committing: `bunx eslint src/` and `bunx prettier --check src/`

## Do's and Don'ts

**Do:**

- Export features only through `index.ts`
- Use path aliases for cross-feature imports
- Wrap all user-visible strings in `msg()`
- Apply `@localized()` to every component
- Use CSS custom properties for all colors
- Use `ThemeController` for theme-reactive components
- Register custom elements in `HTMLElementTagNameMap`
- Use `bun` (not npm/yarn) for all package operations
- Treat `vendor/kanidm/` as a read-only reference for upstream Kanidm behavior

**Don't:**

- Hardcode color values in CSS
- Import directly from feature internals (bypass `index.ts`)
- Use relative paths for cross-feature imports
- Edit files in `src/features/localization/generated/`
- Add gradients or heavy shadows to backgrounds
- Use `cd && command` — use `workdir` parameter instead
- Edit, format, lint, or import from `vendor/kanidm/` — it's a vendored,
  read-only copy of upstream Kanidm, not a workspace crate
