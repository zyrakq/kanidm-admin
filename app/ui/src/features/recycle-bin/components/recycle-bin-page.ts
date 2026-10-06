// Recycle bin: searchable data table, revive confirm, row click ->
// raw-entry modal. Revive is wrapped in withStepUp (D8).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import type { KanidmEntry } from '@/shared/types/kanidm';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/modal-dialog';
import '@/shared/components/confirm-dialog';
import '@/shared/components/ui-button';
import '@/shared/components/ui-badge';
import '@/shared/components/ui-empty-state';
import '@/shared/components/ui-skeleton';
import type { TableColumn } from '@/shared/components/data-table';
import type { RecycleBinEntry } from '../types/recycle-bin.types';
import { recycleBinService } from '../services/recycle-bin.service';
import { recycleBinPageStyles } from './recycle-bin-page.styles';

@customElement('recycle-bin-page')
@localized()
export class RecycleBinPage extends LitElement {
  @state() private entries: RecycleBinEntry[] = [];
  @state() private loading = true;
  @state() private reviveTarget: RecycleBinEntry | null = null;
  @state() private reviveBusy = false;
  @state() private detailOpen = false;
  @state() private detailLoading = false;
  @state() private detailEntry: KanidmEntry | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.entries = await recycleBinService.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load the recycle bin'));
    } finally {
      this.loading = false;
    }
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  private async submitRevive(): Promise<void> {
    if (!this.reviveTarget) {
      return;
    }
    this.reviveBusy = true;
    try {
      const id = this.reviveTarget.id;
      await authService.withStepUp(() => recycleBinService.revive(id));
      notificationService.success(msg(str`Revived entry ${id}`));
      this.reviveTarget = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to revive entry'));
    } finally {
      this.reviveBusy = false;
    }
  }

  private async openDetail(entry: RecycleBinEntry): Promise<void> {
    this.detailOpen = true;
    this.detailEntry = null;
    this.detailLoading = true;
    try {
      this.detailEntry = await recycleBinService.get(entry.id);
    } catch (error) {
      this.toastError(error, msg('Failed to load entry details'));
      this.detailOpen = false;
    } finally {
      this.detailLoading = false;
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
        key: 'uuid',
        header: msg('UUID'),
        render: (row) =>
          html`<span class="mono">${String(row.uuid ?? '—')}</span>`,
      },
      {
        key: 'classes',
        header: msg('Classes'),
        render: (row) =>
          (row.classes as string[]).length > 0
            ? html`<span style="display:inline-flex;flex-wrap:wrap;gap:4px"
                >${(row.classes as string[]).map(
                  (cls) => html`<ui-badge>${cls}</ui-badge>`
                )}</span
              >`
            : '—',
      },
      {
        key: 'actions',
        header: '',
        render: (row) =>
          html`<ui-button
            variant="primary"
            size="sm"
            icon="refresh"
            @click=${(e: Event) => {
              e.stopPropagation();
              this.reviveTarget = row as unknown as RecycleBinEntry;
            }}
          >
            ${msg('Revive')}
          </ui-button>`,
      },
    ];
  }

  private renderAttrs(entry: KanidmEntry) {
    const keys = Object.keys(entry.attrs);
    if (keys.length === 0) {
      return html`<ui-empty-state>${msg('No attributes.')}</ui-empty-state>`;
    }
    return html`
      <ul class="attr-list">
        ${keys.map(
          (key) => html`
            <li class="attr-row">
              <span class="attr-key">${key}</span>
              <span class="attr-values">
                ${entry.attrs[key].map(
                  (value) => html`<div class="attr-value">${value}</div>`
                )}
              </span>
            </li>
          `
        )}
      </ul>
    `;
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Recycle bin')}</h1>
        </div>

        <data-table
          .columns=${this.columns}
          .rows=${this.entries}
          .loading=${this.loading}
          .searchable=${true}
          .emptyMessage=${msg('The recycle bin is empty.')}
          @row-click=${(e: CustomEvent<{ row: RecycleBinEntry }>) =>
            void this.openDetail(e.detail.row)}
        ></data-table>

        ${this.reviveTarget
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.reviveBusy}
                .message=${msg(
                  str`Revive entry "${this.reviveTarget.id}" (${this.reviveTarget.uuid ?? '—'})? It will be restored to the live database.`
                )}
                .confirmLabel=${msg('Revive')}
                @cancel=${() => (this.reviveTarget = null)}
                @confirm=${() => void this.submitRevive()}
              ></confirm-dialog>
            `
          : nothing}

        <modal-dialog
          heading=${msg('Entry details')}
          .open=${this.detailOpen}
          @modal-close=${() => (this.detailOpen = false)}
        >
          ${this.detailLoading
            ? html`<ui-skeleton height="20px" .lines=${4}></ui-skeleton>`
            : this.detailEntry
              ? this.renderAttrs(this.detailEntry)
              : html`<ui-empty-state>${msg('No attributes.')}</ui-empty-state>`}
        </modal-dialog>
      </admin-layout>
    `;
  }

  static styles = recycleBinPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'recycle-bin-page': RecycleBinPage;
  }
}
