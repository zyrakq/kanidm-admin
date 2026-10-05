// Persons list: searchable data table, create modal, delete confirm,
// row click -> detail. All mutations wrapped in withStepUp (D8).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import { navigate } from '@/shared/services/router.service';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/modal-dialog';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-icon';
import type { TableColumn } from '@/shared/components/data-table';
import type { PersonSummary } from '../types/person.types';
import { personService } from '../services/person.service';
import { personListPageStyles } from './person-list-page.styles';

@customElement('person-list-page')
@localized()
export class PersonListPage extends LitElement {
  @state() private persons: PersonSummary[] = [];
  @state() private loading = true;
  @state() private createOpen = false;
  @state() private createBusy = false;
  @state() private createId = '';
  @state() private createDisplayName = '';
  @state() private deleteTarget: PersonSummary | null = null;
  @state() private deleteBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.persons = await personService.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load persons'));
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
    this.createOpen = true;
  }

  private async submitCreate(): Promise<void> {
    if (!this.createId.trim() || !this.createDisplayName.trim()) {
      notificationService.error(msg('Both fields are required.'));
      return;
    }
    this.createBusy = true;
    try {
      await authService.withStepUp(() =>
        personService.create(this.createId.trim(), this.createDisplayName.trim())
      );
      notificationService.success(
        msg(str`Created person ${this.createId.trim()}`)
      );
      this.createOpen = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to create person'));
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
      await authService.withStepUp(() => personService.remove(id));
      notificationService.success(msg(str`Deleted person ${id}`));
      this.deleteTarget = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to delete person'));
    } finally {
      this.deleteBusy = false;
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
      { key: 'displayName', header: msg('Display name') },
      {
        key: 'mail',
        header: msg('Mail'),
        render: (row) =>
          row.mail ? html`<span class="mono">${String(row.mail)}</span>` : '—',
      },
    ];
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Persons')}</h1>
          <button class="btn-primary" type="button" @click=${this.openCreate}>
            <ui-icon name="plus" size="16"></ui-icon>
            ${msg('Create person')}
          </button>
        </div>

        <data-table
          .columns=${this.columns}
          .rows=${this.persons}
          .loading=${this.loading}
          .searchable=${true}
          .emptyMessage=${msg('No persons found.')}
          @row-click=${(e: CustomEvent<{ row: PersonSummary }>) =>
            navigate(
              `/admin/persons/${encodeURIComponent(e.detail.row.id)}`
            )}
        ></data-table>

        <modal-dialog
          heading=${msg('Create person')}
          .open=${this.createOpen}
          .busy=${this.createBusy}
          @modal-close=${() => (this.createOpen = false)}
        >
          <form-field
            label=${msg('Name')}
            fieldId="person-create-id"
            .value=${this.createId}
            placeholder="jdoe"
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createId = e.detail.value)}
          ></form-field>
          <form-field
            label=${msg('Display name')}
            fieldId="person-create-display"
            .value=${this.createDisplayName}
            placeholder=${msg('Jane Doe')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.createDisplayName = e.detail.value)}
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
                  str`Delete person "${this.deleteTarget.displayName}" (${this.deleteTarget.id})? The entry can be revived from the recycle bin.`
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

  static styles = personListPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'person-list-page': PersonListPage;
  }
}
