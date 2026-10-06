// Applications list: searchable data table (Display name / Name mono /
// Linked group), create modal (display name + name + linked GROUP select
// populated from groupService.list()), delete confirm per row, row click
// -> detail modal (display name, name, linked groups each linking to
// /admin/groups/{value}, flattened attrs table). All mutations wrapped
// in withStepUp (D8). NOTE: ScimEntryApplication has NO url field — no
// url column.

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
import { groupService, type GroupSummary } from '@/features/groups';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/modal-dialog';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-icon';
import '@/shared/components/ui-button';
import type { TableColumn } from '@/shared/components/data-table';
import type {
  ApplicationDetail,
  ApplicationSummary,
} from '../types/application.types';
import { applicationService } from '../services/application.service';
import { applicationListPageStyles } from './application-list-page.styles';

@customElement('application-list-page')
@localized()
export class ApplicationListPage extends LitElement {
  @state() private applications: ApplicationSummary[] = [];
  @state() private loading = true;
  @state() private groups: GroupSummary[] = [];
  @state() private createOpen = false;
  @state() private createBusy = false;
  @state() private createName = '';
  @state() private createDisplayName = '';
  @state() private createLinkedGroup = '';
  @state() private deleteTarget: ApplicationSummary | null = null;
  @state() private deleteBusy = false;
  @state() private bulkTargets: ApplicationSummary[] | null = null;
  @state() private bulkBusy = false;
  @state() private detail: ApplicationDetail | null = null;
  @state() private detailLoading = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.applications = await applicationService.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load applications'));
    } finally {
      this.loading = false;
    }
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  private async openCreate(): Promise<void> {
    this.createName = '';
    this.createDisplayName = '';
    this.createLinkedGroup = '';
    this.createOpen = true;
    if (this.groups.length === 0) {
      try {
        this.groups = await groupService.list();
      } catch (error) {
        this.toastError(error, msg('Failed to load groups'));
      }
    }
  }

  private get groupOptions(): { value: string; label: string }[] {
    return this.groups.map((group) => ({
      value: group.id,
      label: group.displayName ?? group.id,
    }));
  }

  private async submitCreate(): Promise<void> {
    if (
      !this.createName.trim() ||
      !this.createDisplayName.trim() ||
      !this.createLinkedGroup
    ) {
      notificationService.error(msg('All fields are required.'));
      return;
    }
    this.createBusy = true;
    try {
      const name = this.createName.trim();
      const displayName = this.createDisplayName.trim();
      const linkedGroup = this.createLinkedGroup;
      await authService.withStepUp(() =>
        applicationService.create({
          name,
          displayname: displayName,
          linked_group: { value: linkedGroup },
        })
      );
      notificationService.success(msg(str`Created application ${name}`));
      this.createOpen = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to create application'));
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
      const id = this.deleteTarget.name;
      await authService.withStepUp(() => applicationService.remove(id));
      notificationService.success(msg(str`Deleted application ${id}`));
      this.deleteTarget = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to delete application'));
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
        bulkDelete('application', targets.map((target) => target.name))
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
      this.toastError(error, msg('Failed to delete application'));
    } finally {
      this.bulkBusy = false;
    }
  }

  private async openDetail(app: ApplicationSummary): Promise<void> {
    this.detail = null;
    this.detailLoading = true;
    try {
      this.detail = await applicationService.get(app.name);
    } catch (error) {
      this.toastError(error, msg('Failed to load application'));
    } finally {
      this.detailLoading = false;
    }
  }

  private get columns(): TableColumn[] {
    return [
      { key: 'displayName', header: msg('Display name') },
      {
        key: 'name',
        header: msg('Name'),
        render: (raw) => {
          const row = raw as unknown as ApplicationSummary;
          return html`<span class="mono">${row.name}</span>`;
        },
      },
      {
        key: 'linkedGroups',
        header: msg('Linked group'),
        render: (raw) => {
          const row = raw as unknown as ApplicationSummary;
          return row.linkedGroups.length > 0
            ? html`<span class="mono">${row.linkedGroups[0]}</span>`
            : '—';
        },
      },
      {
        key: 'actions',
        header: '',
        render: (raw) => {
          const row = raw as unknown as ApplicationSummary;
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

  private renderDetailModal() {
    if (!this.detail) {
      return nothing;
    }
    const attrEntries = Object.entries(this.detail.attrs);
    return html`
      <modal-dialog
        heading=${msg(str`Application ${this.detail.displayName}`)}
        .open=${true}
        @modal-close=${() => (this.detail = null)}
      >
        <div class="detail-section">
          <h3 class="detail-heading">${msg('Overview')}</h3>
          <p class="mono">${this.detail.name}</p>
        </div>
        <div class="detail-section">
          <h3 class="detail-heading">${msg('Linked groups')}</h3>
          ${this.detail.linkedGroups.length > 0
            ? this.detail.linkedGroups.map(
                (group) => html`
                  <a
                    class="linked-group"
                    href="/admin/groups/${encodeURIComponent(group)}"
                    >${group}</a
                  >
                `
              )
            : html`<p class="empty">${msg('No linked groups.')}</p>`}
        </div>
        <div class="detail-section">
          <h3 class="detail-heading">${msg('Attributes')}</h3>
          ${attrEntries.length > 0
            ? html`
                <table class="attrs-table">
                  <thead>
                    <tr>
                      <th>${msg('Attribute')}</th>
                      <th>${msg('Values')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${attrEntries.map(
                      ([key, values]) => html`
                        <tr>
                          <td>${key}</td>
                          <td>${values.join(', ')}</td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              `
            : html`<p class="empty">${msg('No additional attributes.')}</p>`}
        </div>
        <div slot="footer">
          <ui-button @click=${() => (this.detail = null)}>
            ${msg('Close')}
          </ui-button>
        </div>
      </modal-dialog>
    `;
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Applications')}</h1>
          <ui-button
            variant="primary"
            @click=${() => void this.openCreate()}
          >
            ${msg('Create application')}
          </ui-button>
        </div>

        <data-table
          .columns=${this.columns}
          .rows=${this.applications}
          .loading=${this.loading}
          .searchable=${true}
          .selectable=${true}
          .emptyMessage=${msg('No applications found.')}
          @row-click=${(e: CustomEvent<{ row: ApplicationSummary }>) =>
            void this.openDetail(e.detail.row)}
          @bulk-delete=${(e: CustomEvent<{ rows: ApplicationSummary[] }>) =>
            (this.bulkTargets = e.detail.rows)}
        ></data-table>

        <modal-dialog
          heading=${msg('Create application')}
          .open=${this.createOpen}
          .busy=${this.createBusy}
          @modal-close=${() => (this.createOpen = false)}
        >
          <form-field
            label=${msg('Display name')}
            fieldId="application-create-display"
            .value=${this.createDisplayName}
            placeholder=${msg('My Application')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createDisplayName = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Name')}
            fieldId="application-create-name"
            .value=${this.createName}
            placeholder="my-application"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createName = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Linked group')}
            fieldId="application-create-group"
            type="combobox"
            .value=${this.createLinkedGroup}
            .options=${this.groupOptions}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createLinkedGroup = e.detail.value)}
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
                  str`Delete application "${this.deleteTarget.displayName}" (${this.deleteTarget.name})? The entry can be revived from the recycle bin.`
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
                  str`Delete ${this.bulkTargets.length} selected applications? The entries can be revived from the recycle bin.`
                )}
                .confirmLabel=${msg('Delete')}
                @cancel=${() => (this.bulkTargets = null)}
                @confirm=${() => void this.submitBulkDelete()}
              ></confirm-dialog>
            `
          : nothing}

        ${this.detailLoading
          ? html`<modal-dialog
              heading=${msg('Application')}
              .open=${true}
            ></modal-dialog>`
          : this.renderDetailModal()}
      </admin-layout>
    `;
  }

  static styles = applicationListPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'application-list-page': ApplicationListPage;
  }
}
