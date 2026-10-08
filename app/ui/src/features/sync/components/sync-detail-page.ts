// Sync-account detail: no tabs — a stack of cards inside admin-layout.
// Cards: credential portal (URL form + clear), yield attributes
// (textarea one-per-line), token (generate → shown ONCE with copy +
// warning; destroy with confirm), maintenance (force refresh; finalise
// and terminate with STRONG irreversible-action confirms).
// NOTE: there is NO delete — the vendored kanidm client (v1) ships
// without a sync-account delete function.

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-icon';
import '@/shared/components/ui-card';
import '@/shared/components/ui-button';
import '@/shared/components/ui-empty-state';
import '@/shared/components/ui-skeleton';
import type { SyncAccountDetail } from '../types/sync-account.types';
import { syncAccountService } from '../services/sync-account.service';
import { syncDetailPageStyles } from './sync-detail-page.styles';

type ConfirmKind = 'destroy-token' | 'finalise' | 'terminate';

@customElement('sync-detail-page')
@localized()
export class SyncDetailPage extends LitElement {
  /** Sync account id (name or uuid) from the route param. */
  @property() id = '';

  @state() private detail: SyncAccountDetail | null = null;
  @state() private loading = true;
  @state() private notFound = false;

  // Credential portal form state.
  @state() private portalInput = '';
  @state() private portalBusy = false;

  // Yield attributes form state (one attribute per line).
  @state() private yieldInput = '';
  @state() private yieldBusy = false;

  // Token card state.
  @state() private tokenLabel = '';
  @state() private tokenBusy = false;
  /** Generated token — displayed ONCE, cleared on reload/navigation. */
  @state() private revealedToken: string | null = null;
  @state() private destroyTokenBusy = false;

  // Maintenance state.
  @state() private refreshBusy = false;
  @state() private confirmKind: ConfirmKind | null = null;
  @state() private confirmBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.notFound = false;
    this.revealedToken = null;
    try {
      this.detail = await syncAccountService.get(this.id);
      this.portalInput = this.detail.credentialPortal ?? '';
      this.yieldInput = this.detail.yieldAttributes.join('\n');
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'not_found' || error.status === 404)
      ) {
        this.notFound = true;
      } else {
        notificationService.error(
          error instanceof ApiError
            ? error.message
            : msg('Failed to load sync account')
        );
      }
    } finally {
      this.loading = false;
    }
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  // --- Credential portal -------------------------------------------------

  private async savePortal(url: string | null): Promise<void> {
    this.portalBusy = true;
    try {
      await authService.withStepUp(() =>
        syncAccountService.setCredentialPortal(this.id, url)
      );
      notificationService.success(
        url
          ? msg('Credential portal updated.')
          : msg('Credential portal cleared.')
      );
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to update credential portal'));
    } finally {
      this.portalBusy = false;
    }
  }

  // --- Yield attributes --------------------------------------------------

  private async saveYield(): Promise<void> {
    const attrs = this.yieldInput
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    this.yieldBusy = true;
    try {
      await authService.withStepUp(() =>
        syncAccountService.setYieldAttributes(this.id, attrs)
      );
      notificationService.success(msg('Yield attributes updated.'));
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to update yield attributes'));
    } finally {
      this.yieldBusy = false;
    }
  }

  // --- Token -------------------------------------------------------------

  private async generateToken(): Promise<void> {
    if (!this.tokenLabel.trim()) {
      notificationService.error(msg('Label is required.'));
      return;
    }
    this.tokenBusy = true;
    try {
      const token = await authService.withStepUp(() =>
        syncAccountService.generateToken(this.id, this.tokenLabel.trim())
      );
      this.revealedToken = token;
      this.tokenLabel = '';
      notificationService.success(msg('Sync token generated.'));
    } catch (error) {
      this.toastError(error, msg('Failed to generate sync token'));
    } finally {
      this.tokenBusy = false;
    }
  }

  private async copyToken(): Promise<void> {
    if (!this.revealedToken) {
      return;
    }
    try {
      await navigator.clipboard.writeText(this.revealedToken);
      notificationService.success(msg('Token copied to clipboard.'));
    } catch {
      notificationService.error(msg('Failed to copy token.'));
    }
  }

  private async destroyToken(): Promise<void> {
    this.destroyTokenBusy = true;
    try {
      await authService.withStepUp(() =>
        syncAccountService.destroyToken(this.id)
      );
      notificationService.success(msg('Sync token destroyed.'));
      this.revealedToken = null;
      this.confirmKind = null;
    } catch (error) {
      this.toastError(error, msg('Failed to destroy sync token'));
    } finally {
      this.destroyTokenBusy = false;
    }
  }

  // --- Maintenance -------------------------------------------------------

  private async forceRefresh(): Promise<void> {
    this.refreshBusy = true;
    try {
      await authService.withStepUp(() =>
        syncAccountService.forceRefresh(this.id)
      );
      notificationService.success(msg('Force refresh requested.'));
    } catch (error) {
      this.toastError(error, msg('Failed to force refresh'));
    } finally {
      this.refreshBusy = false;
    }
  }

  private get confirmMessage(): string {
    switch (this.confirmKind) {
      case 'destroy-token':
        return msg(
          'Destroy the sync token? The sync client will no longer be able to connect until a new token is issued.'
        );
      case 'finalise':
        return msg(
          'Finalise this sync account? ALL synced entries will be converted into static persons and groups and will no longer be managed by the sync provider. This action is IRREVERSIBLE.'
        );
      case 'terminate':
        return msg(
          'Terminate this sync account? ALL synced entries (persons and groups) will be DELETED. This action is IRREVERSIBLE.'
        );
      default:
        return '';
    }
  }

  private get confirmLabel(): string {
    switch (this.confirmKind) {
      case 'destroy-token':
        return msg('Destroy token');
      case 'finalise':
        return msg('Finalise');
      case 'terminate':
        return msg('Terminate');
      default:
        return msg('Confirm');
    }
  }

  private async runConfirmed(): Promise<void> {
    const kind = this.confirmKind;
    if (!kind) {
      return;
    }
    this.confirmBusy = true;
    try {
      if (kind === 'destroy-token') {
        await this.destroyToken();
      } else if (kind === 'finalise') {
        await authService.withStepUp(() =>
          syncAccountService.finalise(this.id)
        );
        notificationService.success(msg('Sync account finalised.'));
        this.confirmKind = null;
        await this.load();
      } else {
        await authService.withStepUp(() =>
          syncAccountService.terminate(this.id)
        );
        notificationService.success(msg('Sync account terminated.'));
        this.confirmKind = null;
        // The account may no longer exist after termination.
        await this.load();
      }
    } catch (error) {
      this.toastError(
        error,
        kind === 'finalise'
          ? msg('Failed to finalise sync account')
          : msg('Failed to terminate sync account')
      );
    } finally {
      this.confirmBusy = false;
    }
  }

  // --- Render ------------------------------------------------------------

  private renderPortalCard() {
    const hasPortal = (this.detail?.credentialPortal ?? null) !== null;
    return html`
      <ui-card>
        <h2>${msg('Credential Portal')}</h2>
        <p class="hint">
          ${msg(
            'URL of the credential portal where synced users can set their credentials.'
          )}
        </p>
        ${hasPortal
          ? html`<p class="portal-value mono">
              ${this.detail?.credentialPortal}
            </p>`
          : nothing}
        <div class="row">
          <form-field
            label=${msg('Portal URL')}
            fieldId="sync-portal-url"
            type="url"
            .value=${this.portalInput}
            placeholder="https://portal.example.com"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.portalInput = e.detail.value)}
          ></form-field>
          <ui-button
            variant="primary"
            ?disabled=${this.portalBusy || !this.portalInput.trim()}
            @click=${() => void this.savePortal(this.portalInput.trim())}
          >
            ${msg('Save')}
          </ui-button>
          <ui-button
            ?disabled=${this.portalBusy || !hasPortal}
            @click=${() => void this.savePortal(null)}
          >
            ${msg('Clear')}
          </ui-button>
        </div>
      </ui-card>
    `;
  }

  private renderYieldCard() {
    return html`
      <ui-card>
        <h2>${msg('Yield Attributes')}</h2>
        <p class="hint">
          ${msg(
            'Attributes the sync provider yields authority over, one per line. Listed attributes can be modified locally.'
          )}
        </p>
        <form-field
          fieldId="sync-yield-attrs"
          type="textarea"
          .value=${this.yieldInput}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            (this.yieldInput = e.detail.value)}
        ></form-field>
        <div class="row">
          <ui-button
            variant="primary"
            ?loading=${this.yieldBusy}
            @click=${() => void this.saveYield()}
          >
            ${msg('Save')}
          </ui-button>
        </div>
      </ui-card>
    `;
  }

  private renderTokenCard() {
    return html`
      <ui-card>
        <h2>${msg('Sync Token')}</h2>
        <p class="hint">
          ${msg(
            'Token used by the sync client (kanidm-sync) to connect to this account.'
          )}
        </p>
        <div class="row">
          <form-field
            label=${msg('Token label')}
            fieldId="sync-token-label"
            .value=${this.tokenLabel}
            placeholder=${msg('e.g. prod-sync-client')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.tokenLabel = e.detail.value)}
          ></form-field>
          <ui-button
            variant="primary"
            ?loading=${this.tokenBusy}
            @click=${() => void this.generateToken()}
          >
            ${msg('Generate token')}
          </ui-button>
          <ui-button
            variant="danger"
            ?disabled=${this.destroyTokenBusy}
            @click=${() => (this.confirmKind = 'destroy-token')}
          >
            ${msg('Destroy token')}
          </ui-button>
        </div>
        ${this.revealedToken
          ? html`
              <div class="token-reveal">
                <p class="warning">
                  ${msg('Copy this token now — it will NOT be shown again.')}
                </p>
                <div class="token-value">
                  <code>${this.revealedToken}</code>
                  <ui-button @click=${() => void this.copyToken()} icon="key">
                    ${msg('Copy')}
                  </ui-button>
                </div>
              </div>
            `
          : nothing}
      </ui-card>
    `;
  }

  private renderMaintenanceCard() {
    return html`
      <ui-card>
        <h2>${msg('Maintenance')}</h2>
        <p class="hint">
          ${msg(
            'This account cannot be deleted — Kanidm v1 does not support deleting sync accounts.'
          )}
        </p>
        <div class="danger-zone">
          <ui-button
            ?loading=${this.refreshBusy}
            @click=${() => void this.forceRefresh()}
          >
            ${msg('Force refresh')}
          </ui-button>
          <ui-button
            variant="danger"
            @click=${() => (this.confirmKind = 'finalise')}
          >
            ${msg('Finalise')}
          </ui-button>
          <ui-button
            variant="danger"
            @click=${() => (this.confirmKind = 'terminate')}
          >
            ${msg('Terminate')}
          </ui-button>
        </div>
      </ui-card>
    `;
  }

  render() {
    return html`
      <admin-layout>
        <a class="back" href="/admin/sync">
          <ui-icon name="chevron-right" size="14"></ui-icon>
          ${msg('All sync accounts')}
        </a>
        ${this.loading
          ? html`<ui-skeleton height="48px" .lines=${3}></ui-skeleton>`
          : this.notFound || !this.detail
            ? html`<ui-empty-state icon="sync">
                ${msg('Sync account not found.')}
              </ui-empty-state>`
            : html`
                <header class="account-head">
                  <h1>${this.detail.id}</h1>
                  ${this.detail.description
                    ? html`<p class="muted">${this.detail.description}</p>`
                    : nothing}
                  ${this.detail.uuid
                    ? html`<p class="muted mono">${this.detail.uuid}</p>`
                    : nothing}
                </header>
                <div class="cards">
                  ${this.renderPortalCard()} ${this.renderYieldCard()}
                  ${this.renderTokenCard()} ${this.renderMaintenanceCard()}
                </div>
              `}
        ${this.confirmKind
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.confirmBusy}
                .danger=${true}
                .message=${this.confirmMessage}
                .confirmLabel=${this.confirmLabel}
                @cancel=${() => (this.confirmKind = null)}
                @confirm=${() => void this.runConfirmed()}
              ></confirm-dialog>
            `
          : nothing}
      </admin-layout>
    `;
  }

  static styles = syncDetailPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'sync-detail-page': SyncDetailPage;
  }
}
