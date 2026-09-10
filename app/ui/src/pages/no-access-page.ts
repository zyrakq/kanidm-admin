// Shown when an authenticated user is not a member of any admin group:
// explanation plus a sign-out button back to the welcome page.

import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import '@/shared/components/admin-layout';
import { noAccessPageStyles } from './no-access-page.styles';

@customElement('no-access-page')
@localized()
export class NoAccessPage extends LitElement {
  @state() private signingOut = false;

  private async handleSignOut(): Promise<void> {
    this.signingOut = true;
    try {
      await authService.signOut();
    } finally {
      window.location.assign('/');
    }
  }

  render() {
    return html`
      <admin-layout>
        <h1 class="page-title">${msg('Administration')}</h1>

        <section class="card">
          <h2>${msg('No admin access')}</h2>
          <p class="muted">
            ${msg(
              'Your account is not a member of any administration group. Ask your Kanidm administrator for access.'
            )}
          </p>
          <button
            class="btn"
            ?disabled=${this.signingOut}
            @click=${this.handleSignOut}
          >
            ${this.signingOut ? msg('Signing out...') : msg('Sign Out')}
          </button>
        </section>
      </admin-layout>
    `;
  }

  static styles = noAccessPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'no-access-page': NoAccessPage;
  }
}
