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

  private renderMapTable(maps: ScopeMap[], sup: boolean) {
    if (maps.length === 0) {
      return html`<p class="muted">${msg('No entries.')}</p>`;
    }
    return html`
      <table>
        <thead>
          <tr>
            <th>${msg('Group')}</th>
            <th>${msg('Scopes')}</th>
            <th class="col-actions">${msg('Actions')}</th>
          </tr>
        </thead>
        <tbody>
          ${maps.map(
            (map) => html`
              <tr>
                <td class="mono">${map.group}</td>
                <td class="mono">${map.scopes.join(' ')}</td>
                <td class="col-actions">
                  <button
                    class="remove-btn"
                    ?disabled=${this.busy}
                    @click=${() => {
                      this.deleteTarget = { sup, group: map.group };
                    }}
                  >
                    ${msg('Remove')}
                  </button>
                </td>
              </tr>
            `
          )}
        </tbody>
      </table>
    `;
  }

  private renderAddForm(sup: boolean) {
    const group = sup ? this.supGroup : this.scopeGroup;
    const scopes = sup ? this.supScopes : this.scopeScopes;
    const options = this.groups.map((group) => ({
      value: group.id,
      label: group.displayName,
    }));
    return html`
      <form-field
        field-id=${sup ? 'sup-group' : 'scope-group'}
        label=${msg('Group')}
        type="select"
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
        <button
          class="primary-btn"
          ?disabled=${group.trim() === '' ||
          this.parseScopes(scopes).length === 0 ||
          this.busy}
          @click=${() => void this.addMap(sup)}
        >
          ${this.busy ? msg('Saving...') : msg('Add')}
        </button>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return html`<p class="muted">${msg('Loading...')}</p>`;
    }
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Client not available.')}</p>`;
    }
    return html`
      <section class="card">
        <h2>${msg('Scope maps')}</h2>
        <p class="muted">
          ${msg('Scopes granted to members of a group.')}
        </p>
        ${this.renderMapTable(detail.scopeMaps, false)}
      </section>
      <section class="card">
        <h2>${msg('Add scope map')}</h2>
        ${this.renderAddForm(false)}
      </section>
      <section class="card">
        <h2>${msg('Supplemental scope maps')}</h2>
        <p class="muted">
          ${msg('Scopes granted to all users, regardless of group membership.')}
        </p>
        ${this.renderMapTable(detail.supScopeMaps, true)}
      </section>
      <section class="card">
        <h2>${msg('Add supplemental scope map')}</h2>
        ${this.renderAddForm(true)}
      </section>
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
      background: var(--theme-color-surface);
      border: 1px solid var(--theme-color-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    }
    .card h2 {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--theme-color-text-primary);
      word-break: break-all;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 8px;
    }
    th,
    td {
      text-align: left;
      padding: 10px 8px;
      border-bottom: 1px solid var(--theme-color-border);
      font-size: 14px;
    }
    th {
      font-weight: 600;
      color: var(--theme-color-text-secondary);
    }
    .col-actions {
      width: 100px;
      text-align: right;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .primary-btn {
      padding: 9px 16px;
      border: none;
      border-radius: 6px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      background: var(--theme-color-primary);
      color: var(--theme-color-surface);
      transition: background-color 0.2s ease;
    }
    .primary-btn:hover:not(:disabled) {
      background: var(--theme-color-primary-hover);
    }
    .primary-btn:active:not(:disabled) {
      background: var(--theme-color-primary-active);
    }
    .remove-btn {
      padding: 5px 12px;
      background: transparent;
      border: 1px solid var(--theme-color-error);
      border-radius: 6px;
      color: var(--theme-color-error);
      font: inherit;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
    }
    .remove-btn:hover:not(:disabled) {
      background: var(--theme-color-error);
      color: var(--theme-color-surface);
    }
    .primary-btn:disabled,
    .remove-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth2-scope-maps-tab': Oauth2ScopeMapsTab;
  }
}
