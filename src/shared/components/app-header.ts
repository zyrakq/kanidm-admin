import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { ThemeController } from '@/features/theme';
import logoLight from '@/assets/logo-light.svg';
import logoDark from '@/assets/logo-dark.svg';

@customElement('app-header')
export class AppHeader extends LitElement {
  private theme = new ThemeController(this);

  render() {
    const logo = this.theme.theme === 'dark' ? logoDark : logoLight;

    return html`
      <header>
        <div class="header-content">
          <div class="logo-section">
            <img src=${logo} alt="Kanidm Logo" class="logo" />
            <span class="app-name">Kanidm Admin</span>
          </div>
          <div class="actions">
            <theme-toggler></theme-toggler>
          </div>
        </div>
      </header>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    header {
      background: var(--theme-color-surface);
      border-bottom: 1px solid var(--theme-color-border);
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease;
    }

    .header-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1rem 2rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .logo-section {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .logo {
      width: 48px;
      height: 48px;
    }

    .app-name {
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--theme-color-text-primary);
      transition: color 0.2s ease;
    }

    .actions {
      display: flex;
      gap: 1rem;
    }

    @media (max-width: 640px) {
      .header-content {
        padding: 0.75rem 1rem;
      }

      .app-name {
        font-size: 1.125rem;
      }

      .logo {
        width: 40px;
        height: 40px;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'app-header': AppHeader;
  }
}
