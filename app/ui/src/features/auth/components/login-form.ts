import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { ThemeController } from '@/features/theme';
import { brandingService } from '@/features/branding';
import { authService } from '../services/auth.service';
import { firstVisiblePath } from '@/shared/access/section-access';
import { ApiError } from '@/shared/services/http-client';
import type { User } from '../types/auth.types';
import logoLight from '@/assets/logo-light.svg';
import logoDark from '@/assets/logo-dark.svg';
import '@/shared/components/ui-button';
import { loginFormStyles } from './login-form.styles';

@customElement('login-form')
@localized()
export class LoginForm extends LitElement {
  private theme = new ThemeController(this);

  @state() private isAuthenticated = false;
  @state() private user: User | null = null;
  @state() private loading = false;
  @state() private error: string | null = null;
  @state() private username = '';
  @state() private password = '';

  async connectedCallback() {
    super.connectedCallback();
    await brandingService.init();
    window.addEventListener('branding-changed', () => this.requestUpdate());
    await authService.init();
    this.syncState();
  }

  private syncState(): void {
    const state = authService.getAuthState();
    this.isAuthenticated = state.isAuthenticated;
    this.user = state.user;
  }

  private handleUsernameInput(e: Event): void {
    this.username = (e.target as HTMLInputElement).value;
  }

  private handlePasswordInput(e: Event): void {
    this.password = (e.target as HTMLInputElement).value;
  }

  private async handleSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (this.loading) {
      return;
    }

    if (!this.username.trim() || !this.password) {
      this.error = msg('Please fill in all fields.');
      return;
    }

    this.loading = true;
    this.error = null;

    try {
      await authService.signIn(this.username.trim(), this.password);
      const target = firstVisiblePath(authService.getGroups());
      window.location.assign(target ?? '/admin/no-access');
    } catch (error) {
      this.error = this.describeError(error);
    } finally {
      this.loading = false;
    }
  }

  // Localize by error code; the backend message is an English fallback.
  private describeError(error: unknown): string {
    if (error instanceof ApiError) {
      switch (error.code) {
        case 'invalid_credentials':
          return msg('Invalid username or password.');
        case 'kanidm_unreachable':
          return msg(
            'Cannot reach the Kanidm server. Check your connection and try again.'
          );
        default:
          return msg('Sign in failed. Please try again.');
      }
    }
    return msg('Sign in failed. Please try again.');
  }

  render() {
    const slot = this.theme.theme === 'dark' ? 'logo-dark' : 'logo-light';
    const logo =
      brandingService.overrideUrl(slot) ??
      (this.theme.theme === 'dark' ? logoDark : logoLight);

    return html`
      <div class="auth-card">
        <div class="brand">
          <img src=${logo} alt="Kanidm" class="logo" />
        </div>

        <div class="panel">
          <h1 class="title">${msg('Welcome to Kanidm')}</h1>
          <p class="subtitle">${msg('Sign in to continue')}</p>

          ${
            this.isAuthenticated
              ? html`
                  <div class="user-info">
                    <span class="user-name"
                      >${this.user?.displayName || this.user?.username}</span
                    >
                  </div>
                  <div class="actions">
                    <ui-button
                      variant="primary"
                      block
                      @click=${() => {
                        const target = firstVisiblePath(
                          authService.getGroups()
                        );
                        window.location.assign(target ?? '/admin/no-access');
                      }}
                    >
                      ${msg('Go to Dashboard')}
                    </ui-button>
                  </div>
                `
              : html`
                  <form class="form" @submit=${this.handleSubmit}>
                    <div class="field">
                      <label class="label" for="login-username"
                        >${msg('Username')}</label
                      >
                      <input
                        id="login-username"
                        class="input"
                        type="text"
                        autocomplete="username"
                        .value=${this.username}
                        @input=${this.handleUsernameInput}
                        ?disabled=${this.loading}
                        required
                      />
                    </div>
                    <div class="field">
                      <label class="label" for="login-password"
                        >${msg('Password')}</label
                      >
                      <input
                        id="login-password"
                        class="input"
                        type="password"
                        autocomplete="current-password"
                        .value=${this.password}
                        @input=${this.handlePasswordInput}
                        ?disabled=${this.loading}
                        required
                      />
                    </div>
                    ${
                      this.error
                        ? html`<p class="error" role="alert">${this.error}</p>`
                        : nothing
                    }
                    <button type="submit" hidden></button>
                    <ui-button
                      variant="primary"
                      type="submit"
                      block
                      ?loading=${this.loading}
                    >
                      ${this.loading ? msg('Signing in...') : msg('Sign In')}
                    </ui-button>
                  </form>
                `
          }
        </div>
      </div>
    `;
  }

  static styles = loginFormStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'login-form': LoginForm;
  }
}
