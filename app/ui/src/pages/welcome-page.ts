import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { localized } from '@/features/localization';
import '@/shared/components/app-header';
import '@/features/auth/components/auth-status';
import '@/shared/components/footer-info';
import { welcomePageStyles } from './welcome-page.styles';

@customElement('welcome-page')
@localized()
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

  static styles = welcomePageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'welcome-page': WelcomePage;
  }
}
