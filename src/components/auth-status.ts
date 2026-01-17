import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { authService } from '@/services/auth.service';
import { notificationService } from '@/services/notification.service';
import type { User } from '@/types/auth.types';
import logoLight from '@/assets/logo-light.svg';

@customElement('auth-status')
export class AuthStatus extends LitElement {
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

  private async handleSignIn() {
    try {
      this.loading = true;
      // Redirect to /auth/callback after successful OAuth
      await authService.signIn('oidc0', '/auth/callback');
    } catch (error) {
      notificationService.error('Failed to sign in. Please try again.');
    } finally {
      this.loading = false;
    }
  }

  private handleDashboardClick() {
    window.location.href = '/dashboard';
  }

  render() {
    return html`
      <div class="auth-card">
        <img src=${logoLight} alt="Kanidm" class="logo" />

        <h1 class="title">Welcome to Kanidm</h1>
        <p class="subtitle">Sign in to continue</p>

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
                  Go to Dashboard
                </button>
              `
            : html`
                <button
                  class="btn btn-primary"
                  @click=${this.handleSignIn}
                  ?disabled=${this.loading}
                >
                  ${this.loading ? 'Redirecting...' : 'Sign In'}
                </button>
              `}
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      width: 100%;
      max-width: 420px;
    }

    .auth-card {
      background: white;
      border-radius: 8px;
      padding: 3rem 2.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      text-align: center;
    }

    .logo {
      width: 240px;
      height: 240px;
      margin-bottom: 1.5rem;
    }

    .title {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
      margin: 0 0 0.5rem 0;
    }

    .subtitle {
      font-size: 0.9375rem;
      color: #6b7280;
      margin: 0 0 2rem 0;
    }

    .user-info {
      margin: 1.5rem 0;
      padding: 0.75rem 1rem;
      background: #f9fafb;
      border-radius: 6px;
    }

    .user-name {
      font-size: 0.9375rem;
      font-weight: 500;
      color: #1f2937;
    }

    .actions {
      margin-top: 2rem;
    }

    .btn {
      padding: 0.75rem 2rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: background-color 0.2s ease;
      font-family: inherit;
      width: 100%;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: #ff6b35;
      color: white;
    }

    .btn-primary:hover:not(:disabled) {
      background: #e85d2a;
    }

    .btn-primary:active:not(:disabled) {
      background: #d94e1f;
    }

    @media (max-width: 640px) {
      .auth-card {
        padding: 2rem 1.5rem;
      }

      .logo {
        width: 220px;
        height: 220px;
      }

      .title {
        font-size: 1.375rem;
      }

      .subtitle {
        font-size: 0.875rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'auth-status': AuthStatus;
  }
}
