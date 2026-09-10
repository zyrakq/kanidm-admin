// OAuth2 claim-maps tab: claim → group → values mappings with a
// per-claim join strategy (csv | ssv | array), a delete action per
// row and an add form. Loads the detail itself via oauth2Service.get(id).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { groupService, type GroupSummary } from '@/features/groups';
import {
  oauth2Service,
  type Oauth2ClaimMapJoin,
} from '../services/oauth2.service';
import type { ClaimMap, Oauth2RsDetail } from '../types/oauth2.types';

const JOIN_OPTIONS: { value: Oauth2ClaimMapJoin; label: string }[] = [
  { value: 'csv', label: 'csv' },
  { value: 'ssv', label: 'ssv' },
  { value: 'array', label: 'array' },
];

@customElement('oauth2-claim-maps-tab')
@localized()
export class Oauth2ClaimMapsTab extends LitElement {
  /** Client id (name or uuid). */
  @property() id = '';

  @state() private detail: Oauth2RsDetail | null = null;
  @state() private groups: GroupSummary[] = [];
  @state() private loading = true;
  @state() private busy = false;

  // Add-form state.
  @state() private claim = '';
  @state() private group = '';
  @state() private values = '';

  // Delete confirm state.
  @state() private deleteTarget: ClaimMap | null = null;
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
      notificationService.error(msg('Failed to load claim maps.'));
    } finally {
      this.loading = false;
    }
  }

  private parseValues(raw: string): string[] {
    return raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value !== '');
  }

  private async addClaimMap(): Promise<void> {
    const claim = this.claim.trim();
    const group = this.group.trim();
    const values = this.parseValues(this.values);
    if (!claim || !group || values.length === 0 || this.busy) return;
    this.busy = true;
    try {
      await authService.withStepUp(() =>
        oauth2Service.updateClaimMap(this.id, claim, group, values)
      );
      this.claim = '';
      this.group = '';
      this.values = '';
      notificationService.success(msg('Claim map saved.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to save the claim map.'));
    } finally {
      this.busy = false;
    }
  }

  private async setJoin(claim: string, join: Oauth2ClaimMapJoin): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await authService.withStepUp(() =>
        oauth2Service.updateClaimMapJoin(this.id, claim, join)
      );
      notificationService.success(msg('Join strategy updated.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to update the join strategy.'));
    } finally {
      this.busy = false;
    }
  }

  private async deleteClaimMap(): Promise<void> {
    const target = this.deleteTarget;
    if (!target || this.deleting) return;
    this.deleting = true;
    try {
      await authService.withStepUp(() =>
        oauth2Service.deleteClaimMap(this.id, target.claim, target.group)
      );
      this.deleteTarget = null;
      notificationService.success(msg('Claim map removed.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to remove the claim map.'));
    } finally {
      this.deleting = false;
    }
  }

  render() {
    if (this.loading) {
      return html`<p class="muted">${msg('Loading...')}</p>`;
    }
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Client not available.')}</p>`;
    }
    const maps = detail.claimMaps;
    const options = this.groups.map((group) => ({
      value: group.id,
      label: group.displayName,
    }));
    return html`
      <section class="card">
        <h2>${msg('Claim maps')}</h2>
        <p class="muted">
          ${msg('Custom claims added to tokens based on group membership.')}
        </p>
        ${maps.length === 0
          ? html`<p class="muted">${msg('No claim maps configured.')}</p>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th>${msg('Claim')}</th>
                    <th>${msg('Group')}</th>
                    <th>${msg('Values')}</th>
                    <th>${msg('Join')}</th>
                    <th class="col-actions">${msg('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${maps.map(
                    (map) => html`
                      <tr>
                        <td class="mono">${map.claim}</td>
                        <td class="mono">${map.group}</td>
                        <td class="mono">${map.values.join(', ')}</td>
                        <td>
                          <select
                            class="join-select"
                            ?disabled=${this.busy}
                            @change=${(e: Event) => {
                              const join = (e.target as HTMLSelectElement)
                                .value as Oauth2ClaimMapJoin;
                              void this.setJoin(map.claim, join);
                            }}
                          >
                            ${JOIN_OPTIONS.map(
                              (option) => html`
                                <option value=${option.value}>${option.label}</option>
                              `
                            )}
                          </select>
                        </td>
                        <td class="col-actions">
                          <button
                            class="remove-btn"
                            ?disabled=${this.busy}
                            @click=${() => {
                              this.deleteTarget = map;
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
              <p class="muted hint">
                ${msg(
                  'The join strategy applies per claim: csv/ssv join values into one string, array emits a JSON array.'
                )}
              </p>
            `}
      </section>
      <section class="card">
        <h2>${msg('Add claim map')}</h2>
        <form-field
          field-id="claim-name"
          label=${msg('Claim name')}
          .value=${this.claim}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.claim = e.detail.value;
          }}
        ></form-field>
        <form-field
          field-id="claim-group"
          label=${msg('Group')}
          type="select"
          .value=${this.group}
          .options=${options}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.group = e.detail.value;
          }}
        ></form-field>
        <form-field
          field-id="claim-values"
          label=${msg('Values')}
          .value=${this.values}
          hint=${msg('Comma-separated list of values.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.values = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.claim.trim() === '' ||
            this.group.trim() === '' ||
            this.parseValues(this.values).length === 0 ||
            this.busy}
            @click=${() => void this.addClaimMap()}
          >
            ${this.busy ? msg('Saving...') : msg('Add claim map')}
          </button>
        </div>
      </section>
      ${this.deleteTarget !== null
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.deleting}
            confirmLabel=${msg('Remove')}
            message=${msg(
              'Remove this claim map? The claim will no longer be included in tokens.'
            )}
            @confirm=${() => void this.deleteClaimMap()}
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
    .hint {
      margin: 8px 0 0;
      font-size: 13px;
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
    .join-select {
      padding: 5px 8px;
      border: 1px solid var(--theme-color-border);
      border-radius: 6px;
      background: var(--theme-color-background);
      color: var(--theme-color-text-primary);
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .join-select:disabled {
      opacity: 0.6;
      cursor: not-allowed;
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
    'oauth2-claim-maps-tab': Oauth2ClaimMapsTab;
  }
}
