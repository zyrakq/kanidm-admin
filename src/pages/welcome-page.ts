import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@/shared/components/app-header';
import '@/features/auth/components/auth-status';
import '@/shared/components/footer-info';

@customElement('welcome-page')
export class WelcomePage extends LitElement {
  render() {
    return html`
      <div class="page">
        <app-header></app-header>
        <main class="main-content">
          <auth-status></auth-status>
        </main>
        <footer-info></footer-info>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }

    .page {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #f9fafb;
    }

    .main-content {
      flex: 1;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem 1rem;
    }

    @media (max-width: 640px) {
      .main-content {
        padding: 1.5rem 1rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'welcome-page': WelcomePage;
  }
}
