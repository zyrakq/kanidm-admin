import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import logoLight from '../assets/logo-light.svg';

@customElement('app-header')
export class AppHeader extends LitElement {
  render() {
    return html`
      <header>
        <div class="header-content">
          <div class="logo-section">
            <img src=${logoLight} alt="Kanidm Logo" class="logo" />
            <span class="app-name">Kanidm Admin</span>
          </div>
          <div class="actions">
            <!-- Placeholder for future theme/language switchers -->
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
      background: white;
      border-bottom: 1px solid #e5e7eb;
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
      color: #1f2937;
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
