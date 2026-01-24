import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '../services/auth.service';

@customElement('oauth-callback')
export class OAuthCallback extends LitElement {
  @state()
  private status: 'loading' | 'success' | 'error' = 'loading';

  @state()
  private errorMessage = '';

  async connectedCallback() {
    super.connectedCallback();
    await this.handleCallback();
  }

  private async handleCallback() {
    try {
      console.log('[OAuthCallback] Processing OAuth callback...');

      // Wait a bit for TrailBase to set the cookie
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Refresh auth state from TrailBase
      await authService.refresh();

      const authState = authService.getAuthState();

      if (authState.isAuthenticated) {
        console.log('[OAuthCallback] Authentication successful!');
        this.status = 'success';

        // Redirect to dashboard after a short delay
        setTimeout(() => {
          console.log('[OAuthCallback] Redirecting to dashboard...');
          window.location.href = '/dashboard';
        }, 1500);
      } else {
        console.error('[OAuthCallback] Authentication failed - no user found');
        this.status = 'error';
        this.errorMessage = 'Authentication failed. No user session found.';
      }
    } catch (error) {
      console.error('[OAuthCallback] Error processing callback:', error);
      this.status = 'error';
      this.errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
    }
  }

  render() {
    return html`
      <div class="callback-container">
        <div class="callback-card">
          ${this.status === 'loading'
            ? html`
                <div class="spinner"></div>
                <h2>Authenticating...</h2>
                <p>Please wait while we complete the sign in process.</p>
              `
            : this.status === 'success'
              ? html`
                  <div class="success-icon">✓</div>
                  <h2>Success!</h2>
                  <p>You have been authenticated. Redirecting...</p>
                `
              : html`
                  <div class="error-icon">✕</div>
                  <h2>Authentication Failed</h2>
                  <p>${this.errorMessage}</p>
                  <button
                    class="btn"
                    @click=${() => (window.location.href = '/')}
                  >
                    Return to Home
                  </button>
                `}
        </div>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: var(--theme-color-background);
      transition: background-color 0.2s ease;
    }

    .callback-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .callback-card {
      background: var(--theme-color-surface);
      border-radius: 8px;
      padding: 3rem 2.5rem;
      box-shadow: var(--theme-shadow-md);
      text-align: center;
      max-width: 420px;
      width: 100%;
      transition:
        background-color 0.2s ease,
        box-shadow 0.2s ease;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: var(--theme-color-text-primary);
      margin: 1rem 0 0.5rem 0;
      transition: color 0.2s ease;
    }

    p {
      font-size: 0.9375rem;
      color: var(--theme-color-text-secondary);
      margin: 0 0 1.5rem 0;
      transition: color 0.2s ease;
    }

    .spinner {
      border: 3px solid var(--theme-color-border);
      border-top: 3px solid var(--theme-color-primary);
      border-radius: 50%;
      width: 48px;
      height: 48px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
      transition: border-color 0.2s ease;
    }

    @keyframes spin {
      0% {
        transform: rotate(0deg);
      }
      100% {
        transform: rotate(360deg);
      }
    }

    .success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--theme-color-success);
      color: white;
      font-size: 2.5rem;
      line-height: 64px;
      margin: 0 auto 1rem;
    }

    .error-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: var(--theme-color-error);
      color: white;
      font-size: 2.5rem;
      line-height: 64px;
      margin: 0 auto 1rem;
    }

    .btn {
      padding: 0.75rem 2rem;
      font-size: 0.9375rem;
      font-weight: 500;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      background: var(--theme-color-primary);
      color: white;
      font-family: inherit;
      transition: background-color 0.2s ease;
    }

    .btn:hover {
      background: var(--theme-color-primary-hover);
    }

    @media (max-width: 640px) {
      .callback-card {
        padding: 2rem 1.5rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth-callback': OAuthCallback;
  }
}
