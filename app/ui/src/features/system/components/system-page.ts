// System settings page: password badlist + denied names, each as a
// searchable data-table card with an add form (textarea, one entry per
// line) and per-row remove with confirm. All mutations wrapped in
// withStepUp (D8). The default badlist is large; client-side search
// handles it, no pagination in v1 (accepted).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import type { TableColumn } from '@/shared/components/data-table';
import { systemService } from '../services/system.service';
import { systemPageStyles } from './system-page.styles';

/** Which list a pending remove targets. */
type ListKind = 'badlist' | 'deniedNames';

@customElement('system-page')
@localized()
export class SystemPage extends LitElement {
  @state() private badlist: string[] = [];
  @state() private deniedNames: string[] = [];
  @state() private loading = true;
  @state() private badlistAddText = '';
  @state() private deniedNamesAddText = '';
  @state() private badlistBusy = false;
  @state() private deniedNamesBusy = false;
  @state() private removeTarget: { kind: ListKind; value: string } | null = null;
  @state() private removeBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const [badlist, deniedNames] = await Promise.all([
        systemService.badlistGet(),
        systemService.deniedNamesGet(),
      ]);
      this.badlist = badlist;
      this.deniedNames = deniedNames;
    } catch (error) {
      this.toastError(error, msg('Failed to load system settings'));
    } finally {
      this.loading = false;
    }
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  private parseEntries(text: string): string[] {
    return text
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
  }

  private async submitAppend(kind: ListKind): Promise<void> {
    const text = kind === 'badlist' ? this.badlistAddText : this.deniedNamesAddText;
    const entries = this.parseEntries(text);
    if (entries.length === 0) {
      notificationService.error(msg('Enter at least one entry, one per line.'));
      return;
    }
    if (kind === 'badlist') {
      this.badlistBusy = true;
    } else {
      this.deniedNamesBusy = true;
    }
    try {
      await authService.withStepUp(() =>
        kind === 'badlist'
          ? systemService.badlistAppend(entries)
          : systemService.deniedNamesAppend(entries)
      );
      notificationService.success(
        msg(str`Added ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}.`)
      );
      if (kind === 'badlist') {
        this.badlistAddText = '';
      } else {
        this.deniedNamesAddText = '';
      }
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to update the list'));
    } finally {
      if (kind === 'badlist') {
        this.badlistBusy = false;
      } else {
        this.deniedNamesBusy = false;
      }
    }
  }

  private async submitRemove(): Promise<void> {
    if (!this.removeTarget) {
      return;
    }
    this.removeBusy = true;
    const { kind, value } = this.removeTarget;
    try {
      await authService.withStepUp(() =>
        kind === 'badlist'
          ? systemService.badlistRemove([value])
          : systemService.deniedNamesRemove([value])
      );
      notificationService.success(msg(str`Removed "${value}".`));
      this.removeTarget = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to remove the entry'));
    } finally {
      this.removeBusy = false;
    }
  }

  private valueColumn(key: string): TableColumn {
    return {
      key,
      header: msg('Value'),
      render: (row) => html`<span class="mono">${String(row[key])}</span>`,
    };
  }

  private toRows(values: string[]): Record<string, unknown>[] {
    return values.map((value) => ({ value }));
  }

  private renderAddForm(kind: ListKind): unknown {
    const isBadlist = kind === 'badlist';
    const busy = isBadlist ? this.badlistBusy : this.deniedNamesBusy;
    const value = isBadlist ? this.badlistAddText : this.deniedNamesAddText;
    return html`
      <form class="add-form" @submit=${(e: Event) => e.preventDefault()}>
        <form-field
          label=${msg('Add entries (one per line)')}
          fieldId=${isBadlist ? 'badlist-add' : 'denied-names-add'}
          type="textarea"
          .rows=${4}
          .value=${value}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            isBadlist
              ? (this.badlistAddText = e.detail.value)
              : (this.deniedNamesAddText = e.detail.value)}
        ></form-field>
        <div class="form-actions">
          <button
            class="btn-primary"
            type="button"
            ?disabled=${busy}
            @click=${() => void this.submitAppend(kind)}
          >
            ${busy ? msg('Working...') : msg('Add')}
          </button>
        </div>
      </form>
    `;
  }

  private renderRemoveDialog(): unknown {
    if (!this.removeTarget) {
      return nothing;
    }
    const isBadlist = this.removeTarget.kind === 'badlist';
    return html`
      <confirm-dialog
        .open=${true}
        .busy=${this.removeBusy}
        .danger=${true}
        .message=${msg(
          str`Remove "${this.removeTarget.value}" from ${isBadlist ? msg('the password badlist') : msg('the denied names list')}?`
        )}
        .confirmLabel=${msg('Remove')}
        @cancel=${() => (this.removeTarget = null)}
        @confirm=${() => void this.submitRemove()}
      ></confirm-dialog>
    `;
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('System')}</h1>
        </div>

        <section class="card">
          <h2>${msg('Password badlist')}</h2>
          <p class="description">
            ${msg(
              'Passwords in this list are rejected when users set or reset their password.'
            )}
          </p>
          ${this.renderAddForm('badlist')}
          <data-table
            .columns=${[this.valueColumn('value')]}
            .rows=${this.toRows(this.badlist)}
            .loading=${this.loading}
            .searchable=${true}
            .emptyMessage=${msg('The badlist is empty.')}
          ></data-table>
        </section>

        <section class="card">
          <h2>${msg('Denied names')}</h2>
          <p class="description">
            ${msg('Names in this list cannot be used for persons, groups, or accounts.')}
          </p>
          ${this.renderAddForm('deniedNames')}
          <data-table
            .columns=${[this.valueColumn('value')]}
            .rows=${this.toRows(this.deniedNames)}
            .loading=${this.loading}
            .searchable=${true}
            .emptyMessage=${msg('The denied names list is empty.')}
          ></data-table>
        </section>

        ${this.renderRemoveDialog()}
      </admin-layout>
    `;
  }

  static styles = systemPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'system-page': SystemPage;
  }
}
