// Service account validity tab: account_valid_from / account_expire
// datetime attributes via setAttr (empty value = purge), same RFC3339
// conversion pattern as the person overview validity block, kept as
// its own tab per the design.

import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { serviceAccountService } from '../services/service-account.service';
import type { ServiceAccountDetail } from '../types/service-account.types';

/**
 * Kanidm datetime AVAs are RFC3339 strings (Value::new_datetime_s
 * parses with Rfc3339). Project one onto a datetime-local input value
 * (YYYY-MM-DDTHH:MM); returns '' when absent or unparseable.
 */
function toDatetimeLocal(value: string | null): string {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})/.exec(value);
  return match ? match[1] : '';
}

/**
 * datetime-local input value → RFC3339 (UTC) for kanidm. Input is
 * treated as UTC; seconds are added when the browser omits them.
 */
function toRfc3339(value: string): string {
  if (value.length === 16) return `${value}:00Z`;
  if (value.length === 19) return `${value}Z`;
  return value;
}

@customElement('sa-validity-tab')
@localized()
export class SaValidityTab extends LitElement {
  /** Service account id (name or uuid). */
  @property() id = '';

  /** Detail from the container page (self-loaded when absent). */
  @property({ attribute: false })
  sa: ServiceAccountDetail | null = null;

  @state() private loading = false;
  @state() private saving = false;
  @state() private validFrom = '';
  @state() private expire = '';
  private dirty = false;

  private selfLoaded = false;

  connectedCallback(): void {
    super.connectedCallback();
    if (!this.sa && this.id) {
      this.selfLoaded = true;
      void this.load();
    }
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('sa') && this.sa && !this.dirty) {
      this.syncForm();
    }
  }

  private async load(): Promise<void> {
    if (!this.id) return;
    this.loading = true;
    try {
      this.sa = await serviceAccountService.get(this.id);
      this.dirty = false;
      this.syncForm();
    } catch {
      notificationService.error(msg('Failed to load service account.'));
    } finally {
      this.loading = false;
    }
  }

  private syncForm(): void {
    const sa = this.sa;
    if (!sa) return;
    this.validFrom = toDatetimeLocal(sa.accountValidFrom);
    this.expire = toDatetimeLocal(sa.accountExpire);
  }

  private get saId(): string {
    return this.id || this.sa?.id || '';
  }

  /** Tell the container page the service account changed so it can reload. */
  private emitChanged(): void {
    this.dispatchEvent(
      new CustomEvent('sa-changed', { bubbles: true, composed: true })
    );
  }

  private async refreshSa(): Promise<void> {
    if (this.selfLoaded) {
      await this.load();
    }
  }

  private async applyValidity(): Promise<void> {
    const sa = this.sa;
    if (!sa || this.saving) return;
    const operations: Promise<void>[] = [];
    if (this.validFrom !== toDatetimeLocal(sa.accountValidFrom)) {
      operations.push(
        this.validFrom === ''
          ? serviceAccountService.setAttr(this.saId, 'account_valid_from', [])
          : serviceAccountService.setAttr(this.saId, 'account_valid_from', [
              toRfc3339(this.validFrom),
            ])
      );
    }
    if (this.expire !== toDatetimeLocal(sa.accountExpire)) {
      operations.push(
        this.expire === ''
          ? serviceAccountService.setAttr(this.saId, 'account_expire', [])
          : serviceAccountService.setAttr(this.saId, 'account_expire', [
              toRfc3339(this.expire),
            ])
      );
    }
    if (operations.length === 0) {
      return;
    }
    this.saving = true;
    try {
      await authService.withStepUp(() => Promise.all(operations));
      notificationService.success(msg('Account validity updated.'));
      this.dirty = false;
      this.emitChanged();
      await this.refreshSa();
    } catch {
      notificationService.error(msg('Failed to update account validity.'));
    } finally {
      this.saving = false;
    }
  }

  render() {
    if (!this.sa) {
      return html`<p class="muted">
        ${this.loading
          ? msg('Loading...')
          : msg('Service account not available.')}
      </p>`;
    }
    return html`
      <section class="card">
        <h2>${msg('Account validity')}</h2>
        <form-field
          type="datetime-local"
          field-id="sa-valid-from"
          label=${msg('Valid from')}
          .value=${this.validFrom}
          hint=${msg('Empty value removes the restriction.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.validFrom = e.detail.value;
          }}
        ></form-field>
        <form-field
          type="datetime-local"
          field-id="sa-expire"
          label=${msg('Expires')}
          .value=${this.expire}
          hint=${msg('Empty value removes the expiry.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.expire = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.saving}
            @click=${this.applyValidity}
          >
            ${this.saving ? msg('Applying...') : msg('Apply')}
          </button>
        </div>
      </section>
    `;
  }

  static styles = css`
    :host {
      display: block;
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
    .muted {
      margin: 0;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .primary-btn {
      padding: 9px 16px;
      border: none;
      border-radius: 6px;
      background: var(--theme-color-primary);
      color: var(--theme-color-surface);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    .primary-btn:hover:not(:disabled) {
      background: var(--theme-color-primary-hover);
    }
    .primary-btn:active:not(:disabled) {
      background: var(--theme-color-primary-active);
    }
    .primary-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    form-field {
      display: block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-validity-tab': SaValidityTab;
  }
}
