## Brief overview

Guidelines for implementing i18n support in all components using @lit/localize.

## Component requirements

- Every Lit component must use `@localized()` decorator
- All user-visible strings must be wrapped in `msg()` function
- No hardcoded strings outside of `msg()` calls

## Implementation pattern

```typescript
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';

@customElement('my-component')
@localized()
export class MyComponent extends LitElement {
  render() {
    return html`${msg('Hello World')}`;
  }
}
```

## Root initialization

Call `localizationService.init()` once in app-component constructor.

## Translation workflow

1. Wrap strings in `msg()` in component
2. Run `bun i18n:extract` to update XLIFF files
3. Add translations to xliff/*.xlf files
4. Run `bun i18n:build` to generate locale modules
5. Rebuild application
