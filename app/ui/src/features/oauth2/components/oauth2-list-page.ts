// OAuth2 resource-server list: searchable data table, create modal
// (type select: confidential default / public), delete confirm,
// row click -> detail. All mutations wrapped in withStepUp (D8).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/modal-dialog';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-icon';
import type { TableColumn } from '@/shared/components/data-table';
import type { Oauth2RsSummary } from '../types/oauth2.types';
import { oauth2Service } from '../services/oauth2.service';
import { oauth2ListPageStyles } from './oauth2-list-page.styles';

const CREATE_TYPE_CONFIDENTIAL = 'confidential';
const CREATE_TYPE_PUBLIC = 'public';

@customElement('oauth2-list-page')
@localized()
export class Oauth2ListPage extends LitElement {
  @state() private clients: Oauth2RsSummary[] = [];
  @state() private loading = true;
  @state() private createOpen = false;
  @state() private createBusy = false;
  @state() private createType = CREATE_TYPE_CONFIDENTIAL;
  @state() private createId = '';
  @state() private createDisplayName = '';
  @state() private createOrigin = '';
  @state() private deleteTarget: Oauth2RsSummary | null = null;
  @state() private deleteBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.clients = await oauth2Service.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load OAuth2 clients'));
    } finally {
      this.loading = false;
    }
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  private openCreate(): void {
    this.createType = CREATE_TYPE_CONFIDENTIAL;
    this.createId = '';
    this.createDisplayName = '';
    this.createOrigin = '';
    this.createOpen = true;
  }

  private async submitCreate(): Promise<void> {
    if (
      !this.createId.trim() ||
      !this.createDisplayName.trim() ||
      !this.createOrigin.trim()
    ) {
      notificationService.error(msg('All fields are required.'));
      return;
    }
    this.createBusy = true;
    try {
      const name = this.createId.trim();
      const displayName = this.createDisplayName.trim();
      const origin = this.createOrigin.trim();
      await authService.withStepUp(() =>
        this.createType === CREATE_TYPE_PUBLIC
          ? oauth2Service.createPublic(name, displayName, origin)
          : oauth2Service.createBasic(name, displayName, origin)
      );
      notificationService.success(msg(str`Created OAuth2 client ${name}`));
      this.createOpen = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to create OAuth2 client'));
    } finally {
      this.createBusy = false;
    }
  }

  private async submitDelete(): Promise<void> {
    if (!this.deleteTarget) {
      return;
    }
    this.deleteBusy = true;
    try {
      const id = this.deleteTarget.id;
      await authService.withStepUp(() => oauth2Service.remove(id));
      notificationService.success(msg(str`Deleted OAuth2 client ${id}`));
      this.deleteTarget = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to delete OAuth2 client'));
    } finally {
      this.deleteBusy = false;
    }
  }

  private get createTypeOptions(): { value: string; label: string }[] {
    return [
      { value: CREATE_TYPE_CONFIDENTIAL, label: msg('Confidential') },
      { value: CREATE_TYPE_PUBLIC, label: msg('Public') },
    ];
  }

  private get columns(): TableColumn[] {
    return [
      {
        key: 'id',
        header: msg('Name'),
        render: (row) => html`<span class="mono">${String(row.id)}</span>`,
      },
      { key: 'displayName', header: msg('Display name') },
      {
        key: 'origin',
        header: msg('Origin'),
        render: (row) =>
          row.origin ? html`<span class="mono">${String(row.origin)}</span>` : '—',
      },
      {
        key: 'isPublic',
        header: msg('Type'),
        render: (row) =>
          row.isPublic
            ? html`<span class="badge badge-public">${msg('Public')}</span>`
            : html`<span class="badge">${msg('Confidential')}</span>`,
      },
    ];
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('OAuth2 Clients')}</h1>
          <button class="btn-primary" type="button" @click=${this.openCreate}>
            <ui-icon name="plus" size="16"></ui-icon>
            ${msg('Create OAuth2 client')}
          </button>
        </div>

        <data-table
          .columns=${this.columns}
          .rows=${this.clients}
          .loading=${this.loading}
          .searchable=${true}
          .emptyMessage=${msg('No OAuth2 clients found.')}
          @row-click=${(e: CustomEvent<{ row: Oauth2RsSummary }>) =>
            window.location.assign(
              `/admin/oauth2/${encodeURIComponent(e.detail.row.id)}`
            )}
        ></data-table>

        <modal-dialog
          heading=${msg('Create OAuth2 client')}
          .open=${this.createOpen}
          .busy=${this.createBusy}
          @modal-close=${() => (this.createOpen = false)}
        >
          <form-field
            label=${msg('Type')}
            fieldId="oauth2-create-type"
            type="select"
            .value=${this.createType}
            .options=${this.createTypeOptions}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createType = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Name')}
            fieldId="oauth2-create-id"
            .value=${this.createId}
            placeholder="my-client"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createId = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Display name')}
            fieldId="oauth2-create-display"
            .value=${this.createDisplayName}
            placeholder=${msg('My Client')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createDisplayName = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Origin URL')}
            fieldId="oauth2-create-origin"
            type="url"
            .value=${this.createOrigin}
            placeholder="https://app.example.com"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createOrigin = e.detail.value)}
          ></form-field>
          <div slot="footer">
            <button
              class="btn-secondary"
              type="button"
              ?disabled=${this.createBusy}
              @click=${() => (this.createOpen = false)}
            >
              ${msg('Cancel')}
            </button>
            <button
              class="btn-primary"
              type="button"
              ?disabled=${this.createBusy}
              @click=${() => void this.submitCreate()}
            >
              ${this.createBusy ? msg('Working...') : msg('Create')}
            </button>
          </div>
        </modal-dialog>

        ${this.deleteTarget
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.deleteBusy}
                .danger=${true}
                .message=${msg(
                  str`Delete OAuth2 client "${this.deleteTarget.displayName}" (${this.deleteTarget.id})? This cannot be undone.`
                )}
                .confirmLabel=${msg('Delete')}
                @cancel=${() => (this.deleteTarget = null)}
                @confirm=${() => void this.submitDelete()}
              ></confirm-dialog>
            `
          : nothing}
      </admin-layout>
    `;
  }

  static styles = oauth2ListPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth2-list-page': Oauth2ListPage;
  }
}
