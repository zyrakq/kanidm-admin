// Service account credentials tab: shows the credential status
// (vendor idm_service_account_get_credential_status) and offers
// "Generate password" (idm_service_account_generate_password). The
// generated password is displayed exactly once in a modal with a copy
// button and a warning that it will not be shown again.

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import { authService } from '@/features/auth';
import '@/shared/components/modal-dialog';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import '@/shared/components/ui-empty-state';
import '@/shared/components/ui-skeleton';
import { serviceAccountService } from '../services/service-account.service';
import type { CredentialDetailType } from '../types/service-account.types';
import { saCredentialsTabStyles } from './sa-credentials-tab.styles';

/** Human-readable label for a CredentialDetailType variant. */
function credentialTypeLabel(type: CredentialDetailType): string {
  if (typeof type === 'string') {
    switch (type) {
      case 'Password':
        return msg('Password');
      case 'GeneratedPassword':
        return msg('Generated Password');
      default:
        return type;
    }
  }
  if ('Passkey' in type) {
    return msg('Passkey');
  }
  return msg('Password (MFA)');
}

@customElement('sa-credentials-tab')
@localized()
export class SaCredentialsTab extends LitElement {
  /** Service account id (name or uuid). */
  @property() id = '';

  @state() private loading = false;
  @state() private creds: Array<{
    uuid: string;
    type_: CredentialDetailType;
  }> = [];
  @state() private generating = false;
  @state() private generatedPassword: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.id) {
      return;
    }
    this.loading = true;
    try {
      const status = await serviceAccountService.credentialStatus(this.id);
      this.creds = status.creds ?? [];
    } catch {
      notificationService.error(msg('Failed to load credential status.'));
    } finally {
      this.loading = false;
    }
  }

  private async handleGenerate(): Promise<void> {
    if (this.generating) return;
    this.generating = true;
    try {
      const password = await authService.withStepUp(() =>
        serviceAccountService.generatePassword(this.id)
      );
      this.generatedPassword = password;
    } catch {
      notificationService.error(msg('Failed to generate password.'));
    } finally {
      this.generating = false;
    }
  }

  private async handleCopy(): Promise<void> {
    if (!this.generatedPassword) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.generatedPassword);
      notificationService.success(msg('Password copied to clipboard.'));
    } catch {
      notificationService.error(msg('Failed to copy to clipboard.'));
    }
  }

  private closeGeneratedModal(): void {
    // Dismiss for good: the password cannot be retrieved again.
    this.generatedPassword = null;
  }

  private renderCredRow(cred: { uuid: string; type_: CredentialDetailType }) {
    return html`
      <li>
        <ui-card interactive>
          <div class="cred-row">
            <span class="cred-type">${credentialTypeLabel(cred.type_)}</span>
            <span class="cred-uuid" title=${cred.uuid}>${cred.uuid}</span>
          </div>
        </ui-card>
      </li>
    `;
  }

  private renderGeneratedModal() {
    if (this.generatedPassword === null) {
      return nothing;
    }
    return html`
      <modal-dialog
        heading=${msg('Generated password')}
        .open=${true}
        @modal-close=${this.closeGeneratedModal}
      >
        <p class="warning">
          ${msg(
            'This password will not be shown again. Copy it now and share it securely.'
          )}
        </p>
        <code class="generated">${this.generatedPassword}</code>
        <div slot="footer">
          <ui-button @click=${this.handleCopy}>${msg('Copy')}</ui-button>
          <ui-button variant="primary" @click=${this.closeGeneratedModal}>
            ${msg('Done')}
          </ui-button>
        </div>
      </modal-dialog>
    `;
  }

  render() {
    if (this.loading) {
      return html`
        <div
          class="loading"
          role="status"
          aria-label=${msg('Loading credentials…')}
        >
          <ui-skeleton height="40px"></ui-skeleton>
          <ui-skeleton height="56px" .lines=${2}></ui-skeleton>
        </div>
      `;
    }

    return html`
      <section class="credentials">
        <div class="actions">
          <ui-button
            variant="primary"
            ?loading=${this.generating}
            @click=${this.handleGenerate}
          >
            ${msg('Generate password')}
          </ui-button>
        </div>

        ${this.creds.length === 0
          ? html`<ui-empty-state icon="key"
              >${msg('No credentials enrolled.')}</ui-empty-state
            >`
          : html`
              <ul class="cred-list">
                ${this.creds.map((cred) => this.renderCredRow(cred))}
              </ul>
            `}
      </section>

      ${this.renderGeneratedModal()}
    `;
  }

  static styles = saCredentialsTabStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-credentials-tab': SaCredentialsTab;
  }
}
