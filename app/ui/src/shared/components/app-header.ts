import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { ThemeController } from '@/features/theme';
import '@/features/localization/components/locale-switcher';
import '@/features/auth/components/session-indicator';
import logoLight from '@/assets/logo-light.svg';
import logoDark from '@/assets/logo-dark.svg';
import { appHeaderStyles } from './app-header.styles';

@customElement('app-header')
@localized()
export class AppHeader extends LitElement {
  private theme = new ThemeController(this);

  render() {
    const logo = this.theme.theme === 'dark' ? logoDark : logoLight;

    return html`
      <header>
        <div class="header-content">
          <div class="logo-section">
            <img src=${logo} alt="Kanidm Logo" class="logo" />
            <span class="app-name">${msg('Kanidm Admin')}</span>
          </div>
          <div class="actions">
            <session-indicator></session-indicator>
            <theme-toggler></theme-toggler>
            <locale-switcher></locale-switcher>
          </div>
        </div>
      </header>
    `;
  }

  static styles = appHeaderStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'app-header': AppHeader;
  }
}
