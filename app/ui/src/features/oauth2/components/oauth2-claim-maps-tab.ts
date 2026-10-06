// OAuth2 claim-maps tab: claim → group → values mappings with a
// per-claim join strategy (csv | ssv | array), a delete action per
// row and an add form. Loads the detail itself via oauth2Service.get(id).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import '@/shared/components/data-table';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import '@/shared/components/ui-skeleton';
import type { TableColumn } from '@/shared/components/data-table';
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

  private mono(value: string) {
    return html`<span
      style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        font-size: 13px; word-break: break-all;"
      >${value}</span
    >`;
  }

  private renderClaimTable(maps: ClaimMap[]) {
    const columns: TableColumn[] = [
      { key: 'claim', header: msg('Claim'), render: (row) => this.mono(String(row.claim)) },
      { key: 'group', header: msg('Group'), render: (row) => this.mono(String(row.group)) },
      { key: 'values', header: msg('Values'), render: (row) => this.mono(String(row.values)) },
      {
        key: 'join',
        header: msg('Join'),
        render: (row) => {
          const map = row.raw as ClaimMap;
          return html`
            <form-field
              style="--field-margin: 0"
              field-id=${'join-' + map.claim}
              type="select"
              ?disabled=${this.busy}
              .options=${JOIN_OPTIONS}
              @field-input=${(e: CustomEvent<{ value: string }>) => {
                void this.setJoin(map.claim, e.detail.value as Oauth2ClaimMapJoin);
              }}
            ></form-field>
          `;
        },
      },
      {
        key: 'actions',
        header: msg('Actions'),
        render: (row) => html`
          <ui-button
            variant="danger-ghost"
            size="sm"
            ?disabled=${this.busy}
            @click=${() => {
              this.deleteTarget = row.raw as ClaimMap;
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
        .rows=${maps.map((map) => ({
          claim: map.claim,
          group: map.group,
          values: map.values.join(', '),
          raw: map,
        }))}
        .emptyMessage=${msg('No claim maps configured.')}
      ></data-table>
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
    const maps = detail.claimMaps;
    const options = this.groups.map((group) => ({
      value: group.id,
      label: group.displayName ?? group.id,
    }));
    return html`
      <ui-card class="card">
        <h2>${msg('Claim maps')}</h2>
        <p class="muted">
          ${msg('Custom claims added to tokens based on group membership.')}
        </p>
        ${this.renderClaimTable(maps)}
        <p class="muted hint">
          ${msg(
            'The join strategy applies per claim: csv/ssv join values into one string, array emits a JSON array.'
          )}
        </p>
      </ui-card>
      <ui-card class="card">
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
          type="combobox"
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
          <ui-button
            variant="primary"
            ?disabled=${this.claim.trim() === '' ||
            this.group.trim() === '' ||
            this.parseValues(this.values).length === 0}
            ?loading=${this.busy}
            @click=${() => void this.addClaimMap()}
          >
            ${msg('Add claim map')}
          </ui-button>
        </div>
      </ui-card>
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
    'oauth2-claim-maps-tab': Oauth2ClaimMapsTab;
  }
}
