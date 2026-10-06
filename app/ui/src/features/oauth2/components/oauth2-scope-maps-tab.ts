// OAuth2 scope-maps tab: scope maps and supplemental scope maps.
// Each section lists group → scopes rows with a delete action and an
// add form (group select from the groups feature + comma-separated
// scopes). Loads the detail itself via oauth2Service.get(id).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { groupService, type GroupSummary } from '@/features/groups';
import { oauth2Service } from '../services/oauth2.service';
import type { Oauth2RsDetail, ScopeMap } from '../types/oauth2.types';
import '@/shared/components/data-table';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import '@/shared/components/ui-skeleton';
import type { TableColumn } from '@/shared/components/data-table';

@customElement('oauth2-scope-maps-tab')
@localized()
export class Oauth2ScopeMapsTab extends LitElement {
  /** Client id (name or uuid). */
  @property() id = '';

  @state() private detail: Oauth2RsDetail | null = null;
  @state() private groups: GroupSummary[] = [];
  @state() private loading = true;
  @state() private busy = false;

  // Add-form state (shared shape for both sections).
  @state() private scopeGroup = '';
  @state() private scopeScopes = '';
  @state() private supGroup = '';
  @state() private supScopes = '';

  // Delete confirm state: which section + which group.
  @state() private deleteTarget: { sup: boolean; group: string } | null = null;
  @state() private deleting = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      const [detail, groups] = await Promise.all([
        oauth2Service.get(this.id),
        groupService.list().catch(() => [] as GroupSummary[]),
      ]);
      this.detail = detail;
      this.groups = groups;
    } catch {
      notificationService.error(msg('Failed to load scope maps.'));
    } finally {
      this.loading = false;
    }
  }

  private parseScopes(raw: string): string[] {
    return raw
      .split(',')
      .map((scope) => scope.trim())
      .filter((scope) => scope !== '');
  }

  private async addMap(sup: boolean): Promise<void> {
    const group = (sup ? this.supGroup : this.scopeGroup).trim();
    const scopes = this.parseScopes(sup ? this.supScopes : this.scopeScopes);
    if (!group || scopes.length === 0 || this.busy) return;
    this.busy = true;
    try {
      await authService.withStepUp(() =>
        sup
          ? oauth2Service.updateSupScopeMap(this.id, group, scopes)
          : oauth2Service.updateScopeMap(this.id, group, scopes)
      );
      if (sup) {
        this.supGroup = '';
        this.supScopes = '';
      } else {
        this.scopeGroup = '';
        this.scopeScopes = '';
      }
      notificationService.success(
        sup ? msg('Supplemental scope map saved.') : msg('Scope map saved.')
      );
      await this.load();
    } catch {
      notificationService.error(
        sup
          ? msg('Failed to save the supplemental scope map.')
          : msg('Failed to save the scope map.')
      );
    } finally {
      this.busy = false;
    }
  }

  private async deleteMap(): Promise<void> {
    const target = this.deleteTarget;
    if (!target || this.deleting) return;
    this.deleting = true;
    try {
      await authService.withStepUp(() =>
        target.sup
          ? oauth2Service.deleteSupScopeMap(this.id, target.group)
          : oauth2Service.deleteScopeMap(this.id, target.group)
      );
      this.deleteTarget = null;
      notificationService.success(msg('Scope map removed.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to remove the scope map.'));
    } finally {
      this.deleting = false;
    }
  }

  private mono(value: string) {
    return html`<span
      style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px; word-break: break-all;"
      >${value}</span
    >`;
  }

  private renderMapTable(maps: ScopeMap[], sup: boolean) {
    const columns: TableColumn[] = [
      { key: 'group', header: msg('Group'), render: (row) => this.mono(String(row.group)) },
      { key: 'scopes', header: msg('Scopes'), render: (row) => this.mono(String(row.scopes)) },
      {
        key: 'actions',
        header: msg('Actions'),
        render: (row) => html`
          <ui-button
            variant="danger-ghost"
            size="sm"
            ?disabled=${this.busy}
            @click=${() => {
              this.deleteTarget = { sup, group: String(row.group) };
            }}
          >
            ${msg('Remove')}
          </ui-button>
        `,
      },
    ];
    return html`
      <data-table
        .columns=${columns}
        .rows=${maps.map((map) => ({ group: map.group, scopes: map.scopes.join(' ') }))}
        .emptyMessage=${msg('No entries.')}
      ></data-table>
    `;
  }

  private renderAddForm(sup: boolean) {
    const group = sup ? this.supGroup : this.scopeGroup;
    const scopes = sup ? this.supScopes : this.scopeScopes;
    const options = this.groups.map((group) => ({
      value: group.id,
      label: group.displayName ?? group.id,
    }));
    return html`
      <form-field
        field-id=${sup ? 'sup-group' : 'scope-group'}
        label=${msg('Group')}
        type="combobox"
        .value=${group}
        .options=${options}
        @field-input=${(e: CustomEvent<{ value: string }>) => {
          if (sup) {
            this.supGroup = e.detail.value;
          } else {
            this.scopeGroup = e.detail.value;
          }
        }}
      ></form-field>
      <form-field
        field-id=${sup ? 'sup-scopes' : 'scope-scopes'}
        label=${msg('Scopes')}
        .value=${scopes}
        hint=${msg('Comma-separated list of scopes.')}
        @field-input=${(e: CustomEvent<{ value: string }>) => {
          if (sup) {
            this.supScopes = e.detail.value;
          } else {
            this.scopeScopes = e.detail.value;
          }
        }}
      ></form-field>
      <div class="actions">
        <ui-button
          variant="primary"
          ?disabled=${group.trim() === '' ||
          this.parseScopes(scopes).length === 0}
          ?loading=${this.busy}
          @click=${() => void this.addMap(sup)}
        >
          ${msg('Add')}
        </ui-button>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`<ui-skeleton lines="3"></ui-skeleton>`;
    }
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Client not available.')}</p>`;
    }
    return html`
      <ui-card class="card">
        <h2>${msg('Scope maps')}</h2>
        <p class="muted">
          ${msg('Scopes granted to members of a group.')}
        </p>
        ${this.renderMapTable(detail.scopeMaps, false)}
      </ui-card>
      <ui-card class="card">
        <h2>${msg('Add scope map')}</h2>
        ${this.renderAddForm(false)}
      </ui-card>
      <ui-card class="card">
        <h2>${msg('Supplemental scope maps')}</h2>
        <p class="muted">
          ${msg('Scopes granted to all users, regardless of group membership.')}
        </p>
        ${this.renderMapTable(detail.supScopeMaps, true)}
      </ui-card>
      <ui-card class="card">
        <h2>${msg('Add supplemental scope map')}</h2>
        ${this.renderAddForm(true)}
      </ui-card>
      ${this.deleteTarget !== null
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.deleting}
            confirmLabel=${msg('Remove')}
            message=${msg(
              'Remove the scope map for this group? Clients can no longer request its scopes.'
            )}
            @confirm=${() => void this.deleteMap()}
            @cancel=${() => {
              this.deleteTarget = null;
            }}
          ></confirm-dialog>`
        : nothing}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    form-field {
      display: block;
    }
    .muted {
      margin: 0 0 12px;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    .card {
      margin-bottom: 16px;
    }
    .card h2 {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth2-scope-maps-tab': Oauth2ScopeMapsTab;
  }
}
