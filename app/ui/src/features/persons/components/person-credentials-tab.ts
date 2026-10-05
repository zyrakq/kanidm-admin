import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import { authService } from '@/features/auth';
import { kanidmStatusService } from '@/shared/services/kanidm-status.service';
import { personService } from '../services/person.service';
import { buildResetUrl, qrDataUrl, qrPngBlob } from '../utils/reset-link';
import type { CredentialDetailType } from '../types/person.types';
import { personCredentialsTabStyles } from './person-credentials-tab.styles';

/** Default intent TTL in seconds (matches the kanidm CLI default). */
const DEFAULT_INTENT_TTL = 3600;

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

@customElement('person-credentials-tab')
@localized()
export class PersonCredentialsTab extends LitElement {
  /** Person id (name or uuid). */
  @property() id = '';

  @state() private loading = false;
  @state() private creds: Array<{
    uuid: string;
    type_: CredentialDetailType;
  }> = [];
  @state() private intentToken: string | null = null;
  @state() private kanidmUrl: string | null = null;
  @state() private qrOpen = false;
  @state() private emailModalOpen = false;
  @state() private emailValue = '';
  @state() private submitting = false;

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
      const status = await personService.credentialStatus(this.id);
      this.creds = status.creds ?? [];
    } catch (error) {
      notificationService.error(msg('Failed to load credential status.'));
    } finally {
      this.loading = false;
    }
  }

  private async handleCreateIntent(): Promise<void> {
    this.submitting = true;
    try {
      const token = await authService.withStepUp(() =>
        personService.credentialUpdateIntent(this.id, DEFAULT_INTENT_TTL)
      );
      this.intentToken = token;
      this.qrOpen = false;
      // The effective Kanidm base URL is only known backend-side; a
      // failed lookup just hides the link/QR options (token still shown).
      void this.loadKanidmUrl();
      notificationService.success(msg('Credential reset link created.'));
    } catch (error) {
      notificationService.error(msg('Failed to create credential reset link.'));
    } finally {
      this.submitting = false;
    }
  }

  private async loadKanidmUrl(): Promise<void> {
    const status = await kanidmStatusService.fetchStatus();
    this.kanidmUrl = status.kanidmUrl;
  }

  /** Full reset link, or null while the base URL is unknown. */
  private get resetUrl(): string | null {
    if (!this.intentToken || !this.kanidmUrl) {
      return null;
    }
    return buildResetUrl(this.kanidmUrl, this.intentToken);
  }

  private async handleCopyToken(): Promise<void> {
    if (!this.intentToken) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.intentToken);
      notificationService.success(msg('Reset code copied to clipboard.'));
    } catch {
      notificationService.error(msg('Failed to copy to clipboard.'));
    }
  }

  private async handleCopyLink(): Promise<void> {
    const url = this.resetUrl;
    if (!url) {
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      notificationService.success(msg('Reset link copied to clipboard.'));
    } catch {
      notificationService.error(msg('Failed to copy to clipboard.'));
    }
  }

  private toggleQr(): void {
    this.qrOpen = !this.qrOpen;
  }

  private async handleCopyQrImage(): Promise<void> {
    const url = this.resetUrl;
    if (!url) {
      return;
    }
    try {
      const blob = await qrPngBlob(url);
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob }),
      ]);
      notificationService.success(msg('Reset link copied to clipboard.'));
    } catch {
      notificationService.error(msg('Failed to copy to clipboard.'));
    }
  }

  private openEmailModal(): void {
    this.emailValue = '';
    this.emailModalOpen = true;
  }

  private closeEmailModal(): void {
    this.emailModalOpen = false;
  }

  private async handleSendEmail(event: Event): Promise<void> {
    event.preventDefault();
    const email = this.emailValue.trim();
    if (!email) {
      return;
    }
    this.submitting = true;
    try {
      await authService.withStepUp(() =>
        personService.sendCredentialIntent(this.id, DEFAULT_INTENT_TTL, email)
      );
      notificationService.success(msg(str`Reset link sent to ${email}.`));
      this.closeEmailModal();
    } catch (error) {
      notificationService.error(msg('Failed to send reset link.'));
    } finally {
      this.submitting = false;
    }
  }

  private renderCredRow(cred: { uuid: string; type_: CredentialDetailType }) {
    return html`
      <li class="cred-row">
        <span class="cred-type">${credentialTypeLabel(cred.type_)}</span>
        <span class="cred-uuid" title=${cred.uuid}>${cred.uuid}</span>
      </li>
    `;
  }

  private renderIntentPanel() {
    if (!this.intentToken) {
      return nothing;
    }
    const url = this.resetUrl;
    return html`
      <div class="intent-panel">
        <div class="intent-label">${msg('Credential reset link')}</div>
        <div class="intent-field">
          <span class="intent-field-label">${msg('Reset code')}</span>
          <code class="intent-token">${this.intentToken}</code>
        </div>
        ${url
          ? html`
              <div class="intent-field">
                <span class="intent-field-label">${msg('Reset link')}</span>
                <code class="intent-token">${url}</code>
              </div>
            `
          : nothing}
        <div class="intent-actions">
          <button class="btn btn-secondary" @click=${this.handleCopyToken}>
            ${msg('Copy code')}
          </button>
          ${url
            ? html`
                <button class="btn btn-secondary" @click=${this.handleCopyLink}>
                  ${msg('Copy link')}
                </button>
                <button
                  class="btn btn-secondary"
                  aria-expanded=${this.qrOpen ? 'true' : 'false'}
                  @click=${this.toggleQr}
                >
                  ${this.qrOpen ? msg('Hide QR code') : msg('Show QR code')}
                </button>
              `
            : nothing}
        </div>
        ${this.qrOpen && url ? this.renderQr(url) : nothing}
      </div>
    `;
  }

  private renderQr(url: string) {
    return html`
      <div class="qr-block">
        <img
          class="qr-image"
          src=${qrDataUrl(url)}
          alt=${msg('QR code with the credential reset link')}
        />
        <button class="btn btn-secondary" @click=${this.handleCopyQrImage}>
          ${msg('Copy QR image')}
        </button>
      </div>
    `;
  }

  private renderEmailModal() {
    if (!this.emailModalOpen) {
      return nothing;
    }
    return html`
      <div class="modal-backdrop" @click=${this.closeEmailModal}>
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-label=${msg('Email reset link')}
          @click=${(event: Event) => event.stopPropagation()}
        >
          <h3 class="modal-title">${msg('Email reset link')}</h3>
          <form @submit=${this.handleSendEmail}>
            <label class="field">
              <span class="field-label">${msg('Email address')}</span>
              <input
                type="email"
                required
                .value=${this.emailValue}
                @input=${(event: Event & { target: HTMLInputElement }) =>
                  (this.emailValue = event.target.value)}
              />
            </label>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click=${this.closeEmailModal}
              >
                ${msg('Cancel')}
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                ?disabled=${this.submitting}
              >
                ${msg('Send')}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`<p class="muted">${msg('Loading credentials…')}</p>`;
    }

    return html`
      <section class="credentials">
        <div class="actions">
          <button
            class="btn btn-primary"
            ?disabled=${this.submitting}
            @click=${this.handleCreateIntent}
          >
            ${msg('Create credential reset link')}
          </button>
          <button
            class="btn btn-secondary"
            ?disabled=${this.submitting}
            @click=${this.openEmailModal}
          >
            ${msg('Email reset link')}
          </button>
        </div>

        ${this.renderIntentPanel()}
        ${this.creds.length === 0
          ? html`<p class="muted">${msg('No credentials enrolled.')}</p>`
          : html`
              <ul class="cred-list">
                ${this.creds.map((cred) => this.renderCredRow(cred))}
              </ul>
            `}
      </section>

      ${this.renderEmailModal()}
    `;
  }

  static styles = personCredentialsTabStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'person-credentials-tab': PersonCredentialsTab;
  }
}
