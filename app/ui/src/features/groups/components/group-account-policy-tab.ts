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
      await authService.withStepUp(() => groupService.enableAccountPolicy(this.id));
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
      await authService.withStepUp(() => groupService.disableAccountPolicy(this.id));
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
        notificationService.error(msg('Attestation CA list must be valid JSON.'));
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
      await authService.withStepUp(() => groupService.setPolicyAttr(this.id, key, values));
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
                <label class="attr-label" for="ap-${key}">${label()}</label>
                <textarea
                  id="ap-${key}"
                  class="input ca-textarea"
                  rows="4"
                  placeholder="[ ]"
                  .value=${value}
                  @input=${(e: Event) => {
                    this.setValue(key, (e.target as HTMLTextAreaElement).value);
                  }}
                ></textarea>
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
          <button
            class="primary-btn"
            ?disabled=${this.savingAttr !== null || this.purgingAttr !== null}
            @click=${() => void this.saveAttr(key)}
          >
            ${this.savingAttr === key ? msg('Saving...') : msg('Save')}
          </button>
          <button
            class="remove-btn"
            ?disabled=${this.savingAttr !== null ||
            this.purgingAttr !== null ||
            value === ''}
            @click=${() => void this.purge(key)}
          >
            ${this.purgingAttr === key ? msg('Removing...') : msg('Purge')}
          </button>
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
        <section class="card">
          <h2>${msg('Account policy')}</h2>
          <p class="muted">
            ${msg(
              'Enabling turns this group into an account policy group: policy attributes applied to its members are managed here.'
            )}
          </p>
          <div class="actions">
            <button
              class="primary-btn"
              ?disabled=${this.enabling}
              @click=${() => void this.enable()}
            >
              ${this.enabling ? msg('Enabling...') : msg('Enable account policy')}
            </button>
          </div>
        </section>
      `;
    }
    return html`
      <section class="card">
        <h2>${msg('Account policy')}</h2>
        <div class="actions disable-row">
          <button
            class="danger-btn"
            ?disabled=${this.disabling}
            @click=${() => {
              this.disableOpen = true;
            }}
          >
            ${msg('Disable account policy...')}
          </button>
        </div>
        ${NUMERIC_ATTRS.map(({ key, label }) => this.renderAttrRow(key, label))}
        ${this.renderAttrRow(FALLBACK_ATTR, () =>
          msg('Allow primary credential fallback')
        )}
        ${this.renderAttrRow(CA_LIST_ATTR, () =>
          msg('WebAuthn attestation CA list (JSON)')
        )}
      </section>
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
    .attr-label {
      display: block;
      margin-bottom: 6px;
      font-size: 14px;
      font-weight: 500;
      color: var(--theme-color-text-primary);
    }
    .attr-actions {
      display: flex;
      gap: 8px;
      flex-shrink: 0;
      padding-top: 4px;
    }
    .input {
      width: 100%;
      box-sizing: border-box;
      padding: 9px 12px;
      border: 1px solid var(--theme-color-border);
      border-radius: 6px;
      font: inherit;
      color: var(--theme-color-text-primary);
      background: var(--theme-color-surface);
      transition: border-color 0.2s ease;
    }
    .input:focus {
      outline: none;
      border-color: var(--theme-color-primary);
    }
    .ca-textarea {
      resize: vertical;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
    }
    .primary-btn,
    .danger-btn,
    .remove-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .primary-btn {
      background: var(--theme-color-primary);
      color: var(--theme-color-surface);
    }
    .primary-btn:hover:not(:disabled) {
      background: var(--theme-color-primary-hover);
    }
    .primary-btn:active:not(:disabled) {
      background: var(--theme-color-primary-active);
    }
    .danger-btn {
      background: var(--theme-color-error);
      color: var(--theme-color-surface);
    }
    .danger-btn:hover:not(:disabled) {
      filter: brightness(0.9);
    }
    .remove-btn {
      background: transparent;
      border: 1px solid var(--theme-color-border);
      color: var(--theme-color-text-secondary);
    }
    .remove-btn:hover:not(:disabled) {
      border-color: var(--theme-color-error);
      color: var(--theme-color-error);
    }
    .primary-btn:disabled,
    .danger-btn:disabled,
    .remove-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'group-account-policy-tab': GroupAccountPolicyTab;
  }
}
