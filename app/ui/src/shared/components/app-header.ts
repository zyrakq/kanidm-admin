import { LitElement, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { ThemeController } from '@/features/theme';
import '@/features/localization/components/locale-switcher';
import '@/features/auth/components/session-indicator';
import '@/shared/components/ui-icon';
import logoLight from '@/assets/logo-light.svg';
import logoDark from '@/assets/logo-dark.svg';
import { appHeaderStyles } from './app-header.styles';

@customElement('app-header')
@localized()
export class AppHeader extends LitElement {
  private theme = new ThemeController(this);

  /** Show the mobile burger (admin-layout opts in). */
  @property({ type: Boolean }) burger = false;
  /** Bound by admin-layout for the burger icon swap. */
  @property({ type: Boolean }) drawerOpen = false;

  render() {
    const logo = this.theme.theme === 'dark' ? logoDark : logoLight;

    return html`
      <header>
        <div class="header-content">
          ${this.burger
            ? html`
                <button
                  class="burger-btn"
                  type="button"
                  aria-label=${this.drawerOpen ? msg('Close menu') : msg('Open menu')}
                  aria-expanded=${this.drawerOpen}
                  @click=${() =>
                    this.dispatchEvent(
                      new CustomEvent('admin-drawer-toggle', { bubbles: true, composed: true })
                    )}
                >
                  <ui-icon name=${this.drawerOpen ? 'x' : 'menu'} size="22"></ui-icon>
                </button>
              `
            : nothing}
          <div class="left-cluster">
            <img src=${logo} alt="Kanidm Logo" class="logo" />
            <span class="app-name">${msg('Kanidm Admin')}</span>
          </div>
          <div class="spacer"></div>
          <div class="right-cluster">
            <theme-toggler></theme-toggler>
            <locale-switcher></locale-switcher>
            <session-indicator></session-indicator>
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
