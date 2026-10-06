// Service account API tokens tab: lists the account's API tokens
// (vendor idm_service_account_list_api_token), creates new ones
// (idm_service_account_generate_api_token — the raw token string is
// shown exactly once) and revokes them
// (idm_service_account_destroy_api_token), all with step-up auth.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/form-field';
import '@/shared/components/modal-dialog';
import '@/shared/components/ui-button';
import { serviceAccountService } from '../services/service-account.service';
import type { ApiTokenView } from '../types/service-account.types';

@customElement('sa-api-tokens-tab')
@localized()
export class SaApiTokensTab extends LitElement {
  /** Service account id (name or uuid). */
  @property() id = '';

  @state() private tokens: ApiTokenView[] = [];
  @state() private loading = false;
  @state() private revokingId: string | null = null;
  @state() private createOpen = false;
  @state() private creating = false;
  @state() private label = '';
  @state() private expiry = '';
  @state() private createdToken: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.id) return;
    this.loading = true;
    try {
      this.tokens = await serviceAccountService.listApiTokens(this.id);
    } catch {
      notificationService.error(msg('Failed to load API tokens.'));
    } finally {
      this.loading = false;
    }
  }

  private formatExpiry(token: ApiTokenView): string {
    if (token.expiry === null) {
      return msg('Never expires');
    }
    return new Date(token.expiry * 1000).toLocaleString();
  }

  private formatIssued(token: ApiTokenView): string {
    return new Date(token.issued_at * 1000).toLocaleString();
  }

  private openCreate(): void {
    this.label = '';
    this.expiry = '';
    this.createOpen = true;
  }

  private closeCreate(): void {
    this.createOpen = false;
  }

  /**
   * datetime-local input value (YYYY-MM-DDTHH:MM[:SS]) → unix seconds.
   * The input is treated as UTC, matching the RFC3339 handling used for
   * the validity attributes.
   */
  private expiryToUnix(value: string): number | null {
    if (value === '') {
      return null;
    }
    let normalized = value;
    if (normalized.length === 16) normalized += ':00';
    const parsed = Date.parse(`${normalized}Z`);
    return Number.isNaN(parsed) ? null : Math.floor(parsed / 1000);
  }

  private async handleCreate(event: Event): Promise<void> {
    event.preventDefault();
    const label = this.label.trim();
    if (!label || this.creating) return;
    const expiry = this.expiryToUnix(this.expiry);
    this.creating = true;
    try {
      const token = await authService.withStepUp(() =>
        serviceAccountService.createApiToken(this.id, { label, expiry })
      );
      this.createOpen = false;
      this.createdToken = token;
      notificationService.success(msg('API token created.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to create API token.'));
    } finally {
      this.creating = false;
    }
  }

  private async handleCopyToken(): Promise<void> {
    if (!this.createdToken) return;
    try {
      await navigator.clipboard.writeText(this.createdToken);
      notificationService.success(msg('Token copied to clipboard.'));
    } catch {
      notificationService.error(msg('Failed to copy to clipboard.'));
    }
  }

  private closeCreatedModal(): void {
    // Dismiss for good: the token cannot be retrieved again.
    this.createdToken = null;
  }

  private async revoke(token: ApiTokenView): Promise<void> {
    this.revokingId = token.token_id;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.destroyApiToken(this.id, token.token_id)
      );
      notificationService.success(msg('API token revoked.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to revoke API token.'));
    } finally {
      this.revokingId = null;
    }
  }

  private renderCreateModal() {
    if (!this.createOpen) {
      return nothing;
    }
    return html`
      <modal-dialog
        heading=${msg('Create API token')}
        .open=${true}
        .busy=${this.creating}
        @modal-close=${this.closeCreate}
      >
        <form class="modal-form" @submit=${this.handleCreate}>
          <form-field
            label=${msg('Label')}
            field-id="sa-token-label"
            required
            .value=${this.label}
            @field-input=${(event: CustomEvent<{ value: string }>) =>
              (this.label = event.detail.value)}
            @keydown=${(event: KeyboardEvent) => {
              if (event.key === 'Enter') void this.handleCreate(event);
            }}
          ></form-field>
          <form-field
            label=${msg('Expiry (optional)')}
            field-id="sa-token-expiry"
            type="datetime-local"
            .value=${this.expiry}
            @field-input=${(event: CustomEvent<{ value: string }>) =>
              (this.expiry = event.detail.value)}
          ></form-field>
        </form>
        <div slot="footer">
          <ui-button ?disabled=${this.creating} @click=${this.closeCreate}>
            ${msg('Cancel')}
          </ui-button>
          <ui-button
            variant="primary"
            ?loading=${this.creating}
            @click=${this.handleCreate}
          >
            ${msg('Create')}
          </ui-button>
        </div>
      </modal-dialog>
    `;
  }

  private renderCreatedModal() {
    if (this.createdToken === null) {
      return nothing;
    }
    return html`
      <modal-dialog
        heading=${msg('API token created')}
        .open=${true}
        @modal-close=${this.closeCreatedModal}
      >
        <p class="warning">
          ${msg(
            'This token will not be shown again. Copy it now and store it securely.'
          )}
        </p>
        <code class="generated">${this.createdToken}</code>
        <div slot="footer">
          <ui-button @click=${this.handleCopyToken}>${msg('Copy')}</ui-button>
          <ui-button variant="primary" @click=${this.closeCreatedModal}>
            ${msg('Done')}
          </ui-button>
        </div>
      </modal-dialog>
    `;
  }

  render() {
    return html`
      <div class="toolbar">
        <ui-button variant="primary" icon="plus" @click=${this.openCreate}>
          ${msg('Create API token')}
        </ui-button>
      </div>
      <data-table
        .columns=${[
          {
            key: 'label',
            header: msg('Label'),
            render: (row: Record<string, unknown>) =>
              html`${String(row.label)}`,
          },
          {
            key: 'issued',
            header: msg('Issued'),
            render: (row: Record<string, unknown>) =>
              this.formatIssued(row as unknown as ApiTokenView),
          },
          {
            key: 'expiry',
            header: msg('Expiry'),
            render: (row: Record<string, unknown>) =>
              this.formatExpiry(row as unknown as ApiTokenView),
          },
          {
            key: 'actions',
            header: '',
            render: (row: Record<string, unknown>) => html`
              <ui-button
                size="sm"
                variant="danger-ghost"
                ?disabled=${this.revokingId !== null}
                ?loading=${this.revokingId === row.token_id}
                @click=${() =>
                  this.revoke(row as unknown as ApiTokenView)}
              >
                ${this.revokingId === row.token_id
                  ? msg('Revoking...')
                  : msg('Revoke')}
              </ui-button>
            `,
          },
        ]}
        .rows=${this.tokens as unknown as Record<string, unknown>[]}
        ?loading=${this.loading}
        .emptyMessage=${msg('No API tokens.')}
      ></data-table>
      ${this.renderCreateModal()} ${this.renderCreatedModal()}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }
    .modal-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .warning {
      margin: 0 0 12px;
      font-size: 13px;
      font-weight: 500;
      color: var(--theme-color-warning);
    }
    .generated {
      display: block;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--theme-color-text-primary);
      word-break: break-all;
      background: var(--theme-color-surface-sunken);
      border: 1px solid var(--theme-color-border);
      padding: 8px 12px;
      border-radius: var(--theme-radius-md);
    }
    [slot='footer'] {
      display: flex;
      gap: 8px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-api-tokens-tab': SaApiTokensTab;
  }
}
