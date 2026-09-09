import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '../services/auth.service';
import { oauthCallbackStyles } from './oauth-callback.styles';

@customElement('oauth-callback')
@localized()
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
        this.errorMessage = msg(
          'Authentication failed. No user session found.'
        );
      }
    } catch (error) {
      console.error('[OAuthCallback] Error processing callback:', error);
      this.status = 'error';
      this.errorMessage =
        error instanceof Error ? error.message : msg('Unknown error occurred');
    }
  }

  render() {
    return html`
      <div class="callback-container">
        <div class="callback-card">
          ${this.status === 'loading'
            ? html`
                <div class="spinner"></div>
                <h2>${msg('Authenticating...')}</h2>
                <p>
                  ${msg('Please wait while we complete the sign in process.')}
                </p>
              `
            : this.status === 'success'
              ? html`
                  <div class="success-icon">✓</div>
                  <h2>${msg('Success!')}</h2>
                  <p>${msg('You have been authenticated. Redirecting...')}</p>
                `
              : html`
                  <div class="error-icon">✕</div>
                  <h2>${msg('Authentication Failed')}</h2>
                  <p>${this.errorMessage}</p>
                  <button
                    class="btn"
                    @click=${() => (window.location.href = '/')}
                  >
                    ${msg('Return to Home')}
                  </button>
                `}
        </div>
      </div>
    `;
  }

  static styles = oauthCallbackStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth-callback': OAuthCallback;
  }
}
