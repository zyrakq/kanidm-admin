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
      <div class="modal-backdrop" @click=${this.closeCreate}>
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-label=${msg('Create API token')}
          @click=${(event: Event) => event.stopPropagation()}
        >
          <h3 class="modal-title">${msg('Create API token')}</h3>
          <form @submit=${this.handleCreate}>
            <label class="field">
              <span class="field-label">${msg('Label')}</span>
              <input
                type="text"
                required
                .value=${this.label}
                @input=${(
                  event: Event & { target: HTMLInputElement }
                ) => (this.label = event.target.value)}
              />
            </label>
            <label class="field">
              <span class="field-label">${msg('Expiry (optional)')}</span>
              <input
                type="datetime-local"
                .value=${this.expiry}
                @input=${(
                  event: Event & { target: HTMLInputElement }
                ) => (this.expiry = event.target.value)}
              />
            </label>
            <div class="modal-actions">
              <button
                type="button"
                class="btn btn-secondary"
                @click=${this.closeCreate}
              >
                ${msg('Cancel')}
              </button>
              <button
                type="submit"
                class="btn btn-primary"
                ?disabled=${this.creating}
              >
                ${this.creating ? msg('Creating...') : msg('Create')}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  }

  private renderCreatedModal() {
    if (this.createdToken === null) {
      return nothing;
    }
    return html`
      <div
        class="modal-backdrop"
        @click=${this.closeCreatedModal}
      >
        <div
          class="modal"
          role="dialog"
          aria-modal="true"
          aria-label=${msg('API token created')}
          @click=${(event: Event) => event.stopPropagation()}
        >
          <h3 class="modal-title">${msg('API token created')}</h3>
          <p class="warning">
            ${msg(
              'This token will not be shown again. Copy it now and store it securely.'
            )}
          </p>
          <code class="generated">${this.createdToken}</code>
          <div class="modal-actions">
            <button
              type="button"
              class="btn btn-secondary"
              @click=${this.handleCopyToken}
            >
              ${msg('Copy')}
            </button>
            <button
              type="button"
              class="btn btn-primary"
              @click=${this.closeCreatedModal}
            >
              ${msg('Done')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    return html`
      <div class="toolbar">
        <button class="btn btn-primary" @click=${this.openCreate}>
          ${msg('Create API token')}
        </button>
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
              <button
                class="revoke-btn"
                ?disabled=${this.revokingId !== null}
                @click=${() =>
                  this.revoke(row as unknown as ApiTokenView)}
              >
                ${this.revokingId === row.token_id
                  ? msg('Revoking...')
                  : msg('Revoke')}
              </button>
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
    .btn {
      padding: 0.5rem 1rem;
      border-radius: 6px;
      border: 1px solid transparent;
      font-size: 0.875rem;
      font-weight: 500;
      font-family: inherit;
      cursor: pointer;
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        color 0.2s ease;
    }
    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    .btn-primary {
      background: var(--theme-color-primary);
      color: var(--theme-color-background);
    }
    .btn-primary:hover:not(:disabled) {
      background: var(--theme-color-primary-hover);
    }
    .btn-secondary {
      background: transparent;
      border-color: var(--theme-color-border);
      color: var(--theme-color-text-secondary);
    }
    .btn-secondary:hover:not(:disabled) {
      color: var(--theme-color-text-primary);
      border-color: var(--theme-color-text-secondary);
    }
    .revoke-btn {
      padding: 4px 12px;
      border: 1px solid var(--theme-color-error);
      border-radius: 6px;
      background: transparent;
      color: var(--theme-color-error);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .revoke-btn:hover:not(:disabled) {
      background: var(--theme-color-error);
      color: var(--theme-color-surface);
    }
    .revoke-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .modal-backdrop {
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
    }
    .modal {
      background: var(--theme-color-surface);
      border-radius: 8px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
      padding: 1.25rem;
      width: min(24rem, calc(100vw - 2rem));
    }
    .modal-title {
      margin: 0 0 1rem;
      font-size: 1rem;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .warning {
      margin: 0 0 0.75rem;
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--theme-color-warning);
    }
    .generated {
      display: block;
      font-size: 0.8125rem;
      color: var(--theme-color-text-primary);
      word-break: break-all;
      background: var(--theme-color-background);
      padding: 0.5rem;
      border-radius: 6px;
      margin-bottom: 0.75rem;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 0.375rem;
      margin-bottom: 1rem;
    }
    .field-label {
      font-size: 0.8125rem;
      font-weight: 500;
      color: var(--theme-color-text-secondary);
    }
    .field input {
      padding: 0.5rem 0.75rem;
      border: 1px solid var(--theme-color-border);
      border-radius: 6px;
      background: var(--theme-color-background);
      color: var(--theme-color-text-primary);
      font-family: inherit;
      font-size: 0.875rem;
    }
    .field input:focus {
      outline: none;
      border-color: var(--theme-color-primary);
    }
    .modal-actions {
      display: flex;
      justify-content: flex-end;
      gap: 0.5rem;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-api-tokens-tab': SaApiTokensTab;
  }
}
