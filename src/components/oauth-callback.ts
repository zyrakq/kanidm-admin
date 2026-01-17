import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { authService } from '@/services/auth.service';

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
      background: #f9fafb;
    }

    .callback-container {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
      padding: 2rem 1rem;
    }

    .callback-card {
      background: white;
      border-radius: 8px;
      padding: 3rem 2.5rem;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      text-align: center;
      max-width: 420px;
      width: 100%;
    }

    h2 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1f2937;
      margin: 1rem 0 0.5rem 0;
    }

    p {
      font-size: 0.9375rem;
      color: #6b7280;
      margin: 0 0 1.5rem 0;
    }

    .spinner {
      border: 3px solid #f3f4f6;
      border-top: 3px solid #ff6b35;
      border-radius: 50%;
      width: 48px;
      height: 48px;
      animation: spin 1s linear infinite;
      margin: 0 auto 1.5rem;
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
      background: #10b981;
      color: white;
      font-size: 2.5rem;
      line-height: 64px;
      margin: 0 auto 1rem;
    }

    .error-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #ef4444;
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
      background: #ff6b35;
      color: white;
      font-family: inherit;
      transition: background-color 0.2s ease;
    }

    .btn:hover {
      background: #e85d2a;
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
