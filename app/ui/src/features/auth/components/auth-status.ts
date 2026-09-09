import { LitElement, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '../services/auth.service';
import type { User } from '@/features/auth';
import { ThemeController } from '@/features/theme';
import logoLight from '@/assets/logo-light.svg';
import logoDark from '@/assets/logo-dark.svg';
import { authStatusStyles } from './auth-status.styles';

@customElement('auth-status')
@localized()
export class AuthStatus extends LitElement {
  private theme = new ThemeController(this);

  @state()
  private isAuthenticated = false;

  @state()
  private user: User | null = null;

  @property({ type: Boolean })
  loading = false;

  async connectedCallback() {
    super.connectedCallback();
    await this.checkAuthStatus();
  }

  private async checkAuthStatus() {
    await authService.init();
    const authState = authService.getAuthState();
    this.isAuthenticated = authState.isAuthenticated;
    this.user = authState.user;
  }

  private handleDashboardClick() {
    window.location.href = '/dashboard';
  }

  render() {
    const logo = this.theme.theme === 'dark' ? logoDark : logoLight;

    return html`
      <div class="auth-card">
        <img src=${logo} alt="Kanidm" class="logo" />

        <h1 class="title">${msg('Welcome to Kanidm')}</h1>
        <p class="subtitle">${msg('Sign in to continue')}</p>

        ${this.isAuthenticated
          ? html`
              <div class="user-info">
                <span class="user-name"
                  >${this.user?.displayName || this.user?.username}</span
                >
              </div>
            `
          : ''}

        <div class="actions">
          ${this.isAuthenticated
            ? html`
                <button
                  class="btn btn-primary"
                  @click=${this.handleDashboardClick}
                  ?disabled=${this.loading}
                >
                  ${msg('Go to Dashboard')}
                </button>
              `
            : html`
                <button class="btn btn-primary" disabled>
                  ${msg('Sign In (coming soon)')}
                </button>
              `}
        </div>
      </div>
    `;
  }

  static styles = authStatusStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'auth-status': AuthStatus;
  }
}
