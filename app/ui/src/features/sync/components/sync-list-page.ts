// Sync-account list: data table (Name / Description), create modal
// (name + optional description), row click -> /admin/sync/{id}.
// NOTE: there is NO delete — the vendored kanidm client (v1) ships
// without a sync-account delete function, so the UI offers none either.

import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/modal-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-icon';
import type { TableColumn } from '@/shared/components/data-table';
import type { SyncAccountSummary } from '../types/sync-account.types';
import { syncAccountService } from '../services/sync-account.service';
import { syncListPageStyles } from './sync-list-page.styles';

@customElement('sync-list-page')
@localized()
export class SyncListPage extends LitElement {
  @state() private accounts: SyncAccountSummary[] = [];
  @state() private loading = true;
  @state() private createOpen = false;
  @state() private createBusy = false;
  @state() private createId = '';
  @state() private createDescription = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.accounts = await syncAccountService.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load sync accounts'));
    } finally {
      this.loading = false;
    }
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  private openCreate(): void {
    this.createId = '';
    this.createDescription = '';
    this.createOpen = true;
  }

  private async submitCreate(): Promise<void> {
    if (!this.createId.trim()) {
      notificationService.error(msg('Name is required.'));
      return;
    }
    this.createBusy = true;
    try {
      const name = this.createId.trim();
      const description = this.createDescription.trim();
      await authService.withStepUp(() =>
        syncAccountService.create(name, description || undefined)
      );
      notificationService.success(msg(str`Created sync account ${name}`));
      this.createOpen = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to create sync account'));
    } finally {
      this.createBusy = false;
    }
  }

  private get columns(): TableColumn[] {
    return [
      {
        key: 'id',
        header: msg('Name'),
        render: (row) => html`<span class="mono">${String(row.id)}</span>`,
      },
      {
        key: 'description',
        header: msg('Description'),
        render: (row) => String(row.description ?? '—'),
      },
    ];
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Sync Accounts')}</h1>
          <button class="btn-primary" type="button" @click=${this.openCreate}>
            <ui-icon name="plus" size="16"></ui-icon>
            ${msg('Create sync account')}
          </button>
        </div>

        <data-table
          .columns=${this.columns}
          .rows=${this.accounts}
          .loading=${this.loading}
          .searchable=${true}
          .emptyMessage=${msg('No sync accounts found.')}
          @row-click=${(e: CustomEvent<{ row: SyncAccountSummary }>) =>
            window.location.assign(
              `/admin/sync/${encodeURIComponent(e.detail.row.id)}`
            )}
        ></data-table>

        <modal-dialog
          heading=${msg('Create sync account')}
          .open=${this.createOpen}
          .busy=${this.createBusy}
          @modal-close=${() => (this.createOpen = false)}
        >
          <form-field
            label=${msg('Name')}
            fieldId="sync-create-id"
            .value=${this.createId}
            placeholder="my-sync-account"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createId = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Description')}
            fieldId="sync-create-description"
            .value=${this.createDescription}
            placeholder=${msg('Optional description')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createDescription = e.detail.value)}
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
      </admin-layout>
    `;
  }

  static styles = syncListPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'sync-list-page': SyncListPage;
  }
}
