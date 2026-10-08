// Service accounts list: searchable data table, create modal, delete
// confirm, row click -> detail. All mutations wrapped in withStepUp (D8).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { groupService, type GroupSummary } from '@/features/groups';
import { notificationService } from '@/features/notifications';
import {
  bulkDelete,
  friendlyDeleteFailure,
} from '@/shared/services/bulk-delete';
import { ApiError } from '@/shared/services/http-client';
import { navigate } from '@/shared/services/router.service';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/modal-dialog';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-button';
import '@/shared/components/ui-icon';
import type { TableColumn } from '@/shared/components/data-table';
import type { ServiceAccountSummary } from '../types/service-account.types';
import { serviceAccountService } from '../services/service-account.service';
import { serviceAccountListPageStyles } from './service-account-list-page.styles';

@customElement('service-account-list-page')
@localized()
export class ServiceAccountListPage extends LitElement {
  @state() private accounts: ServiceAccountSummary[] = [];
  @state() private loading = true;
  @state() private createOpen = false;
  @state() private createBusy = false;
  @state() private createId = '';
  @state() private createDisplayName = '';
  @state() private createEntryManagedBy = '';
  @state() private createGroups: GroupSummary[] = [];
  @state() private deleteTarget: ServiceAccountSummary | null = null;
  @state() private deleteBusy = false;
  @state() private bulkTargets: ServiceAccountSummary[] | null = null;
  @state() private bulkBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.accounts = await serviceAccountService.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load service accounts'));
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
    this.createDisplayName = '';
    this.createEntryManagedBy = '';
    this.createOpen = true;
    // Entry managed by is required (Kanidm EntryManager ACP: without it
    // nobody can generate API tokens or manage credentials for the
    // account). Populate the group select from the groups feature.
    void groupService
      .list()
      .then((groups) => (this.createGroups = groups))
      .catch(() => (this.createGroups = []));
  }

  private async submitCreate(): Promise<void> {
    if (
      !this.createId.trim() ||
      !this.createDisplayName.trim() ||
      !this.createEntryManagedBy.trim()
    ) {
      notificationService.error(msg('All fields are required.'));
      return;
    }
    this.createBusy = true;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.create(
          this.createId.trim(),
          this.createDisplayName.trim(),
          this.createEntryManagedBy.trim()
        )
      );
      notificationService.success(
        msg(str`Created service account ${this.createId.trim()}`)
      );
      this.createOpen = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to create service account'));
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
      await authService.withStepUp(() => serviceAccountService.remove(id));
      notificationService.success(msg(str`Deleted service account ${id}`));
      this.deleteTarget = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to delete service account'));
    } finally {
      this.deleteBusy = false;
    }
  }

  private async submitBulkDelete(): Promise<void> {
    const targets = this.bulkTargets ?? [];
    if (targets.length === 0) {
      return;
    }
    this.bulkBusy = true;
    try {
      const response = await authService.withStepUp(() =>
        bulkDelete(
          'service_account',
          targets.map((target) => target.id)
        )
      );
      const failures = response.results
        .filter((result) => !result.ok)
        .map((result) => `${result.id}: ${friendlyDeleteFailure(result)}`);
      if (failures.length === 0) {
        notificationService.success(
          msg(str`Deleted ${response.deleted} entries`)
        );
      } else {
        notificationService.error(
          msg(
            str`Deleted ${response.deleted} of ${targets.length}. Failed: ${failures.join(', ')}`
          )
        );
      }
      this.bulkTargets = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to delete service account'));
    } finally {
      this.bulkBusy = false;
    }
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
        key: 'mail',
        header: msg('Mail'),
        render: (row) =>
          row.mail ? html`<span class="mono">${String(row.mail)}</span>` : '—',
      },
      {
        key: 'actions',
        header: '',
        render: (raw) => {
          const row = raw as unknown as ServiceAccountSummary;
          return html`
            <button
              class="btn-delete"
              type="button"
              title=${msg('Delete')}
              aria-label=${msg('Delete')}
              @click=${(e: MouseEvent) => {
                e.stopPropagation();
                this.deleteTarget = row;
              }}
            >
              <ui-icon name="trash" size="18"></ui-icon>
            </button>
          `;
        },
      },
    ];
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Service accounts')}</h1>
          <ui-button variant="primary" icon="plus" @click=${this.openCreate}>
            ${msg('Create service account')}
          </ui-button>
        </div>

        <data-table
          .columns=${this.columns}
          .rows=${this.accounts}
          .loading=${this.loading}
          .searchable=${true}
          .selectable=${true}
          .emptyMessage=${msg('No service accounts found.')}
          @row-click=${(e: CustomEvent<{ row: ServiceAccountSummary }>) =>
            navigate(
              `/admin/service-accounts/${encodeURIComponent(e.detail.row.id)}`
            )}
          @bulk-delete=${(e: CustomEvent<{ rows: ServiceAccountSummary[] }>) =>
            (this.bulkTargets = e.detail.rows)}
        ></data-table>

        <modal-dialog
          heading=${msg('Create service account')}
          .open=${this.createOpen}
          .busy=${this.createBusy}
          @modal-close=${() => (this.createOpen = false)}
        >
          <form-field
            label=${msg('Name')}
            fieldId="service-account-create-id"
            .value=${this.createId}
            placeholder="svc-app"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createId = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Display name')}
            fieldId="service-account-create-display"
            .value=${this.createDisplayName}
            placeholder=${msg('Application service account')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createDisplayName = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Entry managed by')}
            fieldId="service-account-create-managed-by"
            type="combobox"
            .value=${this.createEntryManagedBy}
            .options=${this.createGroups.map((group) => ({
              value: group.id,
              label: group.displayName ?? group.id,
            }))}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createEntryManagedBy = e.detail.value)}
          ></form-field>
          <div slot="footer">
            <ui-button
              ?disabled=${this.createBusy}
              @click=${() => (this.createOpen = false)}
            >
              ${msg('Cancel')}
            </ui-button>
            <ui-button
              variant="primary"
              ?loading=${this.createBusy}
              @click=${() => void this.submitCreate()}
            >
              ${msg('Create')}
            </ui-button>
          </div>
        </modal-dialog>

        ${this.deleteTarget
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.deleteBusy}
                .danger=${true}
                .message=${msg(
                  str`Delete service account "${this.deleteTarget.displayName}" (${this.deleteTarget.id})? The entry can be revived from the recycle bin.`
                )}
                .confirmLabel=${msg('Delete')}
                @cancel=${() => (this.deleteTarget = null)}
                @confirm=${() => void this.submitDelete()}
              ></confirm-dialog>
            `
          : nothing}
        ${this.bulkTargets
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.bulkBusy}
                .danger=${true}
                .message=${msg(
                  str`Delete ${this.bulkTargets.length} selected service accounts? The entries can be revived from the recycle bin.`
                )}
                .confirmLabel=${msg('Delete')}
                @cancel=${() => (this.bulkTargets = null)}
                @confirm=${() => void this.submitBulkDelete()}
              ></confirm-dialog>
            `
          : nothing}
      </admin-layout>
    `;
  }

  static styles = serviceAccountListPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'service-account-list-page': ServiceAccountListPage;
  }
}
