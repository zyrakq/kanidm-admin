// Group account-policy tab: when the group is not an account policy
// group, show an Enable action → groupService.enableAccountPolicy.
// When enabled, show Disable (confirm) plus per-attribute forms for the
// ACCOUNT_POLICY_ATTRS wire names: number inputs for the numeric attrs,
// a textarea for the webauthn attestation CA list JSON and a text input
// for the boolean fallback flag. Values are read from the detail entry
// attrs; writes go through setPolicyAttr / purgeAttr.

import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { attrFirst } from '@/shared/types/kanidm';
import '@/shared/components/confirm-dialog';
import '@/shared/components/ui-card';
import '@/shared/components/ui-button';
import '@/shared/components/form-field';
import { groupService } from '../services/group.service';
import { ACCOUNT_POLICY_ATTRS, type GroupDetail } from '../types/group.types';

/** Attrs edited as numbers (single-valued u32). */
const NUMERIC_ATTRS: { key: string; label: () => string }[] = [
  {
    key: ACCOUNT_POLICY_ATTRS.authSessionExpiry,
    label: () => msg('Auth session expiry (s)'),
  },
  {
    key: ACCOUNT_POLICY_ATTRS.privilegeExpiry,
    label: () => msg('Privilege expiry (s)'),
  },
  {
    key: ACCOUNT_POLICY_ATTRS.authPasswordMinimumLength,
    label: () => msg('Minimum password length'),
  },
  {
    key: ACCOUNT_POLICY_ATTRS.credentialTypeMinimum,
    label: () => msg('Minimum credential type'),
  },
  {
    key: ACCOUNT_POLICY_ATTRS.limitSearchMaxResults,
    label: () => msg('Limit: search max results'),
  },
  {
    key: ACCOUNT_POLICY_ATTRS.limitSearchMaxFilterTest,
    label: () => msg('Limit: search max filter test'),
  },
];

const CA_LIST_ATTR = ACCOUNT_POLICY_ATTRS.webauthnAttestationCaList;
const FALLBACK_ATTR = ACCOUNT_POLICY_ATTRS.allowPrimaryCredFallback;

@customElement('group-account-policy-tab')
@localized()
export class GroupAccountPolicyTab extends LitElement {
  /** Group id (name or uuid). */
  @property() id = '';

  /** Group detail from the container page (drives isAccountPolicy). */
  @property({ attribute: false })
  detail: GroupDetail | null = null;

  @state() private enabling = false;
  @state() private disabling = false;
  @state() private disableOpen = false;
  @state() private savingAttr: string | null = null;
  @state() private purgingAttr: string | null = null;

  // Form values keyed by wire attr name (synced from detail).
  @state() private values: Record<string, string> = {};
  private dirty = false;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('detail') && this.detail && !this.dirty) {
      this.syncForm();
    }
  }

  private syncForm(): void {
    const detail = this.detail;
    if (!detail) return;
    const attrs = detail.raw.attrs ?? {};
    const next: Record<string, string> = {};
    for (const { key } of NUMERIC_ATTRS) {
      next[key] = attrFirst(detail.raw, key) ?? '';
    }
    const caList = attrs[CA_LIST_ATTR];
    next[CA_LIST_ATTR] =
      caList && caList.length > 0 ? JSON.stringify(caList, null, 2) : '';
    next[FALLBACK_ATTR] = attrFirst(detail.raw, FALLBACK_ATTR) ?? '';
    this.values = next;
  }

  private setValue(key: string, value: string): void {
    this.dirty = true;
    this.values = { ...this.values, [key]: value };
  }

  /** Tell the container page the group changed so it can reload. */
  private emitChanged(): void {
    this.dispatchEvent(
      new CustomEvent('group-changed', { bubbles: true, composed: true })
    );
  }

  private async enable(): Promise<void> {
    if (this.enabling) return;
    this.enabling = true;
    try {
      await authService.withStepUp(() =>
        groupService.enableAccountPolicy(this.id)
      );
      notificationService.success(msg('Account policy enabled.'));
      this.dirty = false;
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to enable account policy.'));
    } finally {
      this.enabling = false;
    }
  }

  private async disable(): Promise<void> {
    if (this.disabling) return;
    this.disabling = true;
    try {
      await authService.withStepUp(() =>
        groupService.disableAccountPolicy(this.id)
      );
      notificationService.success(msg('Account policy disabled.'));
      this.disableOpen = false;
      this.dirty = false;
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to disable account policy.'));
    } finally {
      this.disabling = false;
    }
  }

  private async saveAttr(key: string): Promise<void> {
    if (this.savingAttr) return;
    const raw = (this.values[key] ?? '').trim();
    let values: string[];
    if (key === CA_LIST_ATTR) {
      if (raw === '') {
        // Empty JSON textarea purges the attribute.
        await this.purge(key);
        return;
      }
      try {
        const parsed: unknown = JSON.parse(raw);
        values = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
      } catch {
        notificationService.error(
          msg('Attestation CA list must be valid JSON.')
        );
        return;
      }
    } else if (raw === '') {
      await this.purge(key);
      return;
    } else {
      values = [raw];
    }
    this.savingAttr = key;
    try {
      await authService.withStepUp(() =>
        groupService.setPolicyAttr(this.id, key, values)
      );
      notificationService.success(msg('Policy attribute saved.'));
      this.dirty = false;
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to save policy attribute.'));
    } finally {
      this.savingAttr = null;
    }
  }

  private async purge(key: string): Promise<void> {
    if (this.purgingAttr) return;
    this.purgingAttr = key;
    try {
      await authService.withStepUp(() => groupService.purgeAttr(this.id, key));
      notificationService.success(msg('Policy attribute removed.'));
      this.setValue(key, '');
      this.dirty = false;
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to remove policy attribute.'));
    } finally {
      this.purgingAttr = null;
    }
  }

  private renderAttrRow(key: string, label: () => string): unknown {
    const value = this.values[key] ?? '';
    return html`
      <div class="attr-row">
        <div class="attr-field">
          ${key === CA_LIST_ATTR
            ? html`
                <form-field
                  class="ca-textarea"
                  fieldId="ap-${key}"
                  label=${label()}
                  type="textarea"
                  .rows=${4}
                  placeholder="[ ]"
                  .value=${value}
                  @field-input=${(e: CustomEvent<{ value: string }>) => {
                    this.setValue(key, e.detail.value);
                  }}
                ></form-field>
              `
            : html`
                <form-field
                  fieldId="ap-${key}"
                  label=${label()}
                  type=${key === FALLBACK_ATTR ? 'text' : 'number'}
                  .value=${value}
                  hint=${key === FALLBACK_ATTR
                    ? msg('true or false')
                    : msg('Leave empty to remove the attribute.')}
                  @field-input=${(e: CustomEvent<{ value: string }>) => {
                    this.setValue(key, e.detail.value);
                  }}
                ></form-field>
              `}
        </div>
        <div class="attr-actions">
          <ui-button
            variant="primary"
            ?disabled=${this.savingAttr !== null || this.purgingAttr !== null}
            ?loading=${this.savingAttr === key}
            @click=${() => void this.saveAttr(key)}
          >
            ${this.savingAttr === key ? msg('Saving...') : msg('Save')}
          </ui-button>
          <ui-button
            variant="secondary"
            ?disabled=${this.savingAttr !== null ||
            this.purgingAttr !== null ||
            value === ''}
            ?loading=${this.purgingAttr === key}
            @click=${() => void this.purge(key)}
          >
            ${this.purgingAttr === key ? msg('Removing...') : msg('Purge')}
          </ui-button>
        </div>
      </div>
    `;
  }

  render() {
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Group not available.')}</p>`;
    }
    if (!detail.isAccountPolicy) {
      return html`
        <p class="muted">
          ${msg('This group is not an account policy group.')}
        </p>
        <ui-card>
          <h2 slot="header">${msg('Account policy')}</h2>
          <p class="muted">
            ${msg(
              'Enabling turns this group into an account policy group: policy attributes applied to its members are managed here.'
            )}
          </p>
          <div class="actions">
            <ui-button
              variant="primary"
              ?loading=${this.enabling}
              @click=${() => void this.enable()}
            >
              ${this.enabling
                ? msg('Enabling...')
                : msg('Enable account policy')}
            </ui-button>
          </div>
        </ui-card>
      `;
    }
    return html`
      <ui-card>
        <h2 slot="header">${msg('Account policy')}</h2>
        <div class="actions disable-row">
          <ui-button
            variant="danger"
            ?disabled=${this.disabling}
            @click=${() => {
              this.disableOpen = true;
            }}
          >
            ${msg('Disable account policy...')}
          </ui-button>
        </div>
        ${NUMERIC_ATTRS.map(({ key, label }) => this.renderAttrRow(key, label))}
        ${this.renderAttrRow(FALLBACK_ATTR, () =>
          msg('Allow primary credential fallback')
        )}
        ${this.renderAttrRow(CA_LIST_ATTR, () =>
          msg('WebAuthn attestation CA list (JSON)')
        )}
      </ui-card>
      ${this.disableOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.disabling}
            confirmLabel=${msg('Disable')}
            message=${msg(
              'Disabling removes the account_policy class from this group. Policy attributes stop applying to its members. Continue?'
            )}
            @confirm=${() => void this.disable()}
            @cancel=${() => {
              this.disableOpen = false;
            }}
          ></confirm-dialog>`
        : nothing}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .muted {
      margin: 0 0 12px;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    ui-card {
      margin-bottom: 16px;
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .disable-row {
      justify-content: flex-start;
      margin-bottom: 16px;
    }
    .attr-row {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 12px 0;
      border-top: 1px solid var(--theme-color-border);
    }
    .attr-field {
      flex: 1;
      min-width: 0;
    }
    .attr-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      padding-top: 4px;
    }
    .ca-textarea {
      --field-margin: 0;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'group-account-policy-tab': GroupAccountPolicyTab;
  }
}
