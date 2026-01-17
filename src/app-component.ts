import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@lit-labs/router';
import { authService } from './services/auth.service';

// Import components (they will be registered as custom elements)
import './components/welcome-page';
import './components/oauth-callback';
import './components/dashboard-page';
import './components/toast-container';

@customElement('app-component')
export class AppComponent extends LitElement {
  // Router - основной роутер с глобальными listeners (Router наследует от Routes)
  private _router = new Router(this, [
    {
      path: '/',
      render: () => html`<welcome-page></welcome-page>`,
      enter: async () => {
        await authService.init();
        return true;
      },
    },
    {
      path: '/auth/callback',
      render: () => html`<oauth-callback></oauth-callback>`,
    },
    {
      path: '/dashboard',
      render: () => html`<dashboard-page></dashboard-page>`,
      enter: async () => {
        await authService.init();
        if (!authService.isAuthenticated()) {
          this._router.goto('/');
          return false;
        }
        return true;
      },
    },
  ]);

  render() {
    return html`${this._router.outlet()}`;
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'app-component': AppComponent;
  }
}
