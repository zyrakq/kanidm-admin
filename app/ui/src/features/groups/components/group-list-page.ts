// Groups list: searchable data table, create modal, delete confirm,
// row click -> detail. All mutations wrapped in withStepUp (D8).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
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
import '@/shared/components/ui-icon';
import type { TableColumn } from '@/shared/components/data-table';
import type { GroupSummary } from '../types/group.types';
import { groupService } from '../services/group.service';
import { groupListPageStyles } from './group-list-page.styles';

@customElement('group-list-page')
@localized()
export class GroupListPage extends LitElement {
  @state() private groups: GroupSummary[] = [];
  @state() private loading = true;
  @state() private createOpen = false;
  @state() private createBusy = false;
  @state() private createId = '';
  @state() private deleteTarget: GroupSummary | null = null;
  @state() private deleteBusy = false;
  @state() private bulkTargets: GroupSummary[] | null = null;
  @state() private bulkBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.groups = await groupService.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load groups'));
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
    this.createOpen = true;
  }

  private async submitCreate(): Promise<void> {
    if (!this.createId.trim()) {
      notificationService.error(msg('Name is required.'));
      return;
    }
    this.createBusy = true;
    try {
      const id = this.createId.trim();
      await authService.withStepUp(() => groupService.create(id));
      notificationService.success(msg(str`Created group ${id}`));
      this.createOpen = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to create group'));
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
      await authService.withStepUp(() => groupService.remove(id));
      notificationService.success(msg(str`Deleted group ${id}`));
      this.deleteTarget = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to delete group'));
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
        bulkDelete('group', targets.map((target) => target.id))
      );
      const failures = response.results
        .filter((result) => !result.ok)
        .map((result) => `${result.id}: ${friendlyDeleteFailure(result)}`);
      if (failures.length === 0) {
        notificationService.success(msg(str`Deleted ${response.deleted} entries`));
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
      this.toastError(error, msg('Failed to delete group'));
    } finally {
      this.bulkBusy = false;
    }
  }

  private get columns(): TableColumn[] {
    return [
      {
        key: 'id',
        header: msg('Name'),
        render: (row) =>
          html`<span class="mono">${String(row.id)}</span>`,
      },
      {
        key: 'displayName',
        header: msg('Display name'),
        render: (row) => String(row.displayName ?? '—'),
      },
      {
        key: 'memberCount',
        header: msg('Members'),
        render: (row) => String(row.memberCount),
      },
      {
        key: 'isPosix',
        header: msg('POSIX'),
        render: (row) =>
          row.isPosix
            ? html`<span class="badge badge-posix">${msg('POSIX')}</span>`
            : html`<span class="badge">${msg('No')}</span>`,
      },
      {
        key: 'actions',
        header: '',
        render: (raw) => {
          const row = raw as unknown as GroupSummary;
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
          <h1>${msg('Groups')}</h1>
          <button class="btn-primary" type="button" @click=${this.openCreate}>
            <ui-icon name="plus" size="16"></ui-icon>
            ${msg('Create group')}
          </button>
        </div>

        <data-table
          .columns=${this.columns}
          .rows=${this.groups}
          .loading=${this.loading}
          .searchable=${true}
          .selectable=${true}
          .emptyMessage=${msg('No groups found.')}
          @row-click=${(e: CustomEvent<{ row: GroupSummary }>) =>
            navigate(
              `/admin/groups/${encodeURIComponent(e.detail.row.id)}`
            )}
          @bulk-delete=${(e: CustomEvent<{ rows: GroupSummary[] }>) =>
            (this.bulkTargets = e.detail.rows)}
        ></data-table>

        <modal-dialog
          heading=${msg('Create group')}
          .open=${this.createOpen}
          .busy=${this.createBusy}
          @modal-close=${() => (this.createOpen = false)}
        >
          <form-field
            label=${msg('Name')}
            fieldId="group-create-id"
            .value=${this.createId}
            placeholder="team-devs"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createId = e.detail.value)}
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
                  str`Delete group "${this.deleteTarget.displayName ?? this.deleteTarget.id}" (${this.deleteTarget.id})? The entry can be revived from the recycle bin.`
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
                  str`Delete ${this.bulkTargets.length} selected groups? The entries can be revived from the recycle bin.`
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

  static styles = groupListPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'group-list-page': GroupListPage;
  }
}
