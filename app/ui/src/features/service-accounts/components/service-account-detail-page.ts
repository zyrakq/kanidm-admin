// Service account detail: header (avatar initials, display name, id,
// uuid) + tab bar routing to the sub-management tabs. Loads the service
// account once and passes the id to each tab; tabs own their data
// loading (overview/validity receive the detail from the container).

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import { navigate } from '@/shared/services/router.service';
import '@/shared/components/admin-layout';
import '@/shared/components/avatar';
import '@/shared/components/ui-icon';
import '@/shared/components/tab-bar';
import '@/shared/components/confirm-dialog';
import type { TabDef } from '@/shared/components/tab-bar';
import './sa-overview-tab';
import './sa-credentials-tab';
import './sa-api-tokens-tab';
import './sa-sessions-tab';
import './sa-ssh-tab';
import './sa-posix-tab';
import './sa-validity-tab';
import type { ServiceAccountDetail } from '../types/service-account.types';
import { serviceAccountService } from '../services/service-account.service';
import { serviceAccountDetailPageStyles } from './service-account-detail-page.styles';

@customElement('service-account-detail-page')
@localized()
export class ServiceAccountDetailPage extends LitElement {
  /** Service account id (name or uuid) from the route param. */
  @property() id = '';

  @state() private sa: ServiceAccountDetail | null = null;
  @state() private loading = true;
  @state() private notFound = false;
  @state() private activeTab = 'overview';
  @state() private deleteOpen = false;
  @state() private deleteBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.notFound = false;
    try {
      this.sa = await serviceAccountService.get(this.id);
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'not_found' || error.status === 404)) {
        this.notFound = true;
      } else {
        notificationService.error(
          error instanceof ApiError
            ? error.message
            : msg('Failed to load service account')
        );
      }
    } finally {
      this.loading = false;
    }
  }

  private handleTabChange(e: CustomEvent<{ id: string }>): void {
    this.activeTab = e.detail.id;
  }

  private async submitDelete(): Promise<void> {
    if (!this.sa) {
      return;
    }
    this.deleteBusy = true;
    try {
      const id = this.sa.id;
      await authService.withStepUp(() => serviceAccountService.remove(id));
      notificationService.success(msg(str`Deleted service account ${id}`));
      this.deleteOpen = false;
      navigate('/admin/service-accounts');
    } catch (error) {
      notificationService.error(
        error instanceof ApiError
          ? error.message
          : msg('Failed to delete service account')
      );
    } finally {
      this.deleteBusy = false;
    }
  }

  private renderTab(): ReturnType<typeof html> {
    switch (this.activeTab) {
      case 'credentials':
        return html`<sa-credentials-tab .id=${this.id}></sa-credentials-tab>`;
      case 'api-tokens':
        return html`<sa-api-tokens-tab .id=${this.id}></sa-api-tokens-tab>`;
      case 'sessions':
        return html`<sa-sessions-tab .id=${this.id}></sa-sessions-tab>`;
      case 'ssh':
        return html`<sa-ssh-tab .id=${this.id}></sa-ssh-tab>`;
      case 'posix':
        return html`<sa-posix-tab .id=${this.id}></sa-posix-tab>`;
      case 'validity':
        return html`<sa-validity-tab
          .id=${this.id}
          .sa=${this.sa}
          @sa-changed=${() => void this.load()}
        ></sa-validity-tab>`;
      default:
        return html`<sa-overview-tab
          .id=${this.id}
          .sa=${this.sa}
          @sa-changed=${() => void this.load()}
        ></sa-overview-tab>`;
    }
  }

  /** Built per render so labels re-evaluate msg() after locale switches. */
  private get tabs(): TabDef[] {
    return [
      { id: 'overview', label: msg('Overview') },
      { id: 'credentials', label: msg('Credentials') },
      { id: 'api-tokens', label: msg('API Tokens') },
      { id: 'sessions', label: msg('Sessions') },
      { id: 'ssh', label: msg('SSH keys') },
      { id: 'posix', label: msg('POSIX') },
      { id: 'validity', label: msg('Validity') },
    ];
  }

  render() {
    return html`
      <admin-layout>
        <a class="back" href="/admin/service-accounts">
          <ui-icon name="chevron-right" size="14"></ui-icon>
          ${msg('All service accounts')}
        </a>
        ${this.loading
          ? html`<p class="muted">${msg('Loading...')}</p>`
          : this.notFound || !this.sa
            ? html`<p class="muted">${msg('Service account not found.')}</p>`
            : html`
                <header class="sa-head">
                  <ui-avatar name=${this.sa.displayName} size="48"></ui-avatar>
                  <div>
                    <h1>${this.sa.displayName}</h1>
                    <p class="muted mono">${this.sa.id}</p>
                    ${this.sa.uuid
                      ? html`<p class="muted mono">${this.sa.uuid}</p>`
                      : nothing}
                  </div>
                  <button
                    class="btn-delete"
                    type="button"
                    ?disabled=${this.deleteBusy}
                    @click=${() => (this.deleteOpen = true)}
                  >
                    <ui-icon name="trash" size="16"></ui-icon>
                    ${msg('Delete')}
                  </button>
                </header>
                <tab-bar
                  .tabs=${this.tabs}
                  .active=${this.activeTab}
                  @tab-change=${this.handleTabChange}
                ></tab-bar>
                <section class="tab-content">${this.renderTab()}</section>
              `}
        ${this.deleteOpen && this.sa
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.deleteBusy}
                .danger=${true}
                .message=${msg(
                  str`Delete service account "${this.sa.displayName}" (${this.sa.id})? The entry can be revived from the recycle bin.`
                )}
                .confirmLabel=${msg('Delete')}
                @cancel=${() => (this.deleteOpen = false)}
                @confirm=${() => void this.submitDelete()}
              ></confirm-dialog>
            `
          : nothing}
      </admin-layout>
    `;
  }

  static styles = serviceAccountDetailPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'service-account-detail-page': ServiceAccountDetailPage;
  }
}
