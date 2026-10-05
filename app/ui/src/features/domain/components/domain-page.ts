// Domain settings page: read-only info, identity forms (display name,
// LDAP base DN with confirm, SSID), behaviour toggles + max queryable
// attrs, and the domain image (preview / upload / remove). All writes
// wrapped in withStepUp (D8).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-icon';
import type { DomainInfo } from '../types/domain.types';
import { domainService } from '../services/domain.service';
import { domainPageStyles } from './domain-page.styles';

const DOMAIN_IMAGE_URL = '/api/kanidm/ui/images/domain';

@customElement('domain-page')
@localized()
export class DomainPage extends LitElement {
  @state() private info: DomainInfo | null = null;
  @state() private loading = true;
  @state() private busy = false;

  // Identity form state (synced from `info` unless the user has edits).
  @state() private displayName = '';
  @state() private ldapBasedn = '';
  @state() private ssid = '';
  private dirty = false;

  // Behaviour form state.
  @state() private maxQueryableAttrs = '';

  // Account-policy minimum credential type on idm_all_persons
  // ('any' | 'mfa' | 'passkey' | 'attested_passkey'); null = unset/
  // unreadable, the row stays disabled.
  @state() private credentialMinimum:
    | 'any'
    | 'mfa'
    | 'passkey'
    | 'attested_passkey'
    | null = null;

  // Image state.
  @state() private imageFailed = false;
  @state() private imageBusy = false;

  // Confirm state.
  @state() private basednConfirmOpen = false;
  @state() private imageRemoveOpen = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.info = await domainService.get();
      if (!this.dirty) {
        this.displayName = this.info.displayName ?? '';
        this.ldapBasedn = this.info.ldapBasedn ?? '';
        this.ssid = this.info.ssid ?? '';
        this.maxQueryableAttrs = this.maxQueryableValue();
      }
      this.imageFailed = false;
    } catch (error) {
      this.toastError(error, msg('Failed to load domain settings'));
    } finally {
      this.loading = false;
    }
    // Separate fetch: a failure here only disables the policy row,
    // never the whole page.
    try {
      this.credentialMinimum =
        await domainService.getCredentialTypeMinimum();
    } catch {
      this.credentialMinimum = null;
    }
  }

  private maxQueryableValue(): string {
    const raw = this.info?.raw.attrs['ldap_max_queryable_attrs']?.[0];
    return raw ?? '';
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  private async run(
    action: () => Promise<void>,
    successMessage: string,
    failMessage: string
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await authService.withStepUp(action);
      notificationService.success(successMessage);
      await this.load();
    } catch (error) {
      this.toastError(error, failMessage);
    } finally {
      this.busy = false;
    }
  }

  private async saveIdentity(): Promise<void> {
    const info = this.info;
    if (!info) return;
    const displayName = this.displayName.trim();
    const basedn = this.ldapBasedn.trim();
    const ssid = this.ssid.trim();
    const operations: Promise<void>[] = [];
    if (displayName !== '' && displayName !== (info.displayName ?? '')) {
      operations.push(domainService.setDisplayName(displayName));
    }
    if (basedn !== '' && basedn !== (info.ldapBasedn ?? '')) {
      operations.push(domainService.setLdapBasedn(basedn));
    }
    if (ssid !== '' && ssid !== (info.ssid ?? '')) {
      operations.push(domainService.setSsid(ssid));
    }
    if (operations.length === 0) return;
    this.busy = true;
    try {
      await authService.withStepUp(() => Promise.all(operations));
      notificationService.success(msg('Identity settings saved.'));
      this.dirty = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to save identity settings'));
    } finally {
      this.busy = false;
    }
  }

  private confirmBasedn(): void {
    const basedn = this.ldapBasedn.trim();
    const info = this.info;
    if (!info || basedn === '' || basedn === (info.ldapBasedn ?? '')) {
      return;
    }
    this.basednConfirmOpen = true;
  }

  private async saveMaxQueryableAttrs(): Promise<void> {
    const raw = this.maxQueryableAttrs.trim();
    const count = Number(raw);
    if (raw === '' || !Number.isInteger(count) || count < 0) {
      notificationService.error(msg('Enter a non-negative whole number.'));
      return;
    }
    await this.run(
      () => domainService.setLdapMaxQueryableAttrs(count),
      msg('Max queryable attributes updated.'),
      msg('Failed to update max queryable attributes')
    );
  }

  private async uploadImage(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    this.imageBusy = true;
    try {
      await authService.withStepUp(() => domainService.setImage(file));
      notificationService.success(msg('Domain image updated.'));
      this.imageFailed = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to upload the domain image'));
    } finally {
      this.imageBusy = false;
      input.value = '';
    }
  }

  private async removeImage(): Promise<void> {
    this.imageRemoveOpen = false;
    this.imageBusy = true;
    try {
      await authService.withStepUp(() => domainService.removeImage());
      notificationService.success(msg('Domain image removed.'));
      this.imageFailed = false;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to remove the domain image'));
    } finally {
      this.imageBusy = false;
    }
  }

  private renderToggleRow(
    label: string,
    hint: string,
    checked: boolean,
    onFlip: () => void,
    disabled: boolean
  ) {
    return html`
      <div class="toggle-row">
        <div class="toggle-text">
          <span class="toggle-label">${label}</span>
          <span class="muted">${hint}</span>
        </div>
        <label class="switch">
          <input
            type="checkbox"
            .checked=${checked}
            ?disabled=${disabled}
            @change=${onFlip}
          />
          <span class="slider"></span>
        </label>
      </div>
    `;
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Domain')}</h1>
        </div>
        ${this.loading
          ? html`<p class="muted">${msg('Loading...')}</p>`
          : this.info
            ? this.renderCards(this.info)
            : html`<p class="muted">${msg('Domain not available.')}</p>`}
      </admin-layout>
    `;
  }

  private renderCards(info: DomainInfo) {
    return html`
      <section class="card">
        <h2>${msg('Info')}</h2>
        <dl class="info-grid">
          <dt>${msg('Domain name')}</dt>
          <dd class="mono">${info.name}</dd>
          <dt>${msg('UUID')}</dt>
          <dd class="mono">${info.uuid ?? '—'}</dd>
          <dt>${msg('LDAP base DN')}</dt>
          <dd class="mono">${info.ldapBasedn ?? '—'}</dd>
        </dl>
      </section>

      <section class="card">
        <h2>${msg('Identity')}</h2>
        <form-field
          field-id="domain-display-name"
          label=${msg('Display name')}
          .value=${this.displayName}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.displayName = e.detail.value;
          }}
        ></form-field>
        <form-field
          field-id="domain-ldap-basedn"
          label=${msg('LDAP base DN')}
          .value=${this.ldapBasedn}
          hint=${msg('Changing this rebuilds the LDAP directory tree.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.ldapBasedn = e.detail.value;
          }}
        ></form-field>
        <form-field
          field-id="domain-ssid"
          label=${msg('Wireless network name (SSID)')}
          .value=${this.ssid}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.ssid = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.busy}
            @click=${() => this.confirmBasedn()}
          >
            ${this.busy ? msg('Saving...') : msg('Save')}
          </button>
        </div>
      </section>

      <section class="card">
        <h2>${msg('Behaviour')}</h2>
        ${this.renderToggleRow(
          msg('Easter eggs'),
          msg('Enable seasonal kanidm easter eggs.'),
          info.allowEasterEggs,
          () => {
            const next = !info.allowEasterEggs;
            void this.run(
              () => domainService.setAllowEasterEggs(next),
              msg('Setting updated.'),
              msg('Failed to update easter eggs')
            );
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('Account recovery'),
          msg(
            'Enables self-service credential reset for persons. Enabling is a security-relevant change.'
          ),
          info.allowAccountRecovery,
          () => {
            const next = !info.allowAccountRecovery;
            void this.run(
              () => domainService.setAllowAccountRecovery(next),
              msg('Setting updated.'),
              msg('Failed to update account recovery')
            );
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('LDAP unix password bind'),
          msg('Allow binding to LDAP with unix passwords.'),
          info.raw.attrs['ldap_allow_unix_pw_bind']?.[0] === 'true',
          () => {
            const current =
              info.raw.attrs['ldap_allow_unix_pw_bind']?.[0] === 'true';
            void this.run(
              () => domainService.setAllowUnixPwBind(!current),
              msg('Setting updated.'),
              msg('Failed to update LDAP unix password bind')
            );
          },
          this.busy
        )}
        <form-field
          field-id="domain-max-queryable-attrs"
          label=${msg('Max queryable attributes')}
          type="number"
          .value=${this.maxQueryableAttrs}
          hint=${msg(
            'Maximum number of attributes an LDAP search may request.'
          )}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.maxQueryableAttrs = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.busy}
            @click=${() => void this.saveMaxQueryableAttrs()}
          >
            ${this.busy ? msg('Saving...') : msg('Save')}
          </button>
        </div>
      </section>

      <section class="card">
        <h2>${msg('Account policy')}</h2>
        ${this.renderToggleRow(
          msg('Mandatory two-factor authentication'),
          msg(
            'Applies to all persons. While enabled, password-only credentials cannot be saved: MFA (TOTP or passkey) is required. Turning it off allows password-only logins.'
          ),
          this.credentialMinimum !== null &&
            this.credentialMinimum !== 'any',
          () => {
            const current =
              this.credentialMinimum !== null &&
              this.credentialMinimum !== 'any';
            void this.run(
              () =>
                domainService.setCredentialTypeMinimum(current ? 'any' : 'mfa'),
              msg('Setting updated.'),
              msg('Failed to update the two-factor policy')
            );
          },
          this.busy || this.credentialMinimum === null
        )}
      </section>

      <section class="card">
        <h2>${msg('Image')}</h2>
        <div class="image-row">
          ${this.imageFailed
            ? html`<div class="image-placeholder">${msg('No image')}</div>`
            : html`<img
                class="image-preview"
                src=${DOMAIN_IMAGE_URL}
                alt=${msg('Domain image')}
                @error=${() => (this.imageFailed = true)}
              />`}
          <div class="toggle-text">
            <span class="toggle-label">${msg('Domain image')}</span>
            <span class="muted">
              ${msg('Shown on the login page and in emails.')}
            </span>
          </div>
        </div>
        <div class="actions">
          <label class="secondary-btn image-upload">
            <input
              type="file"
              accept="image/png,image/jpeg,image/gif,image/svg+xml,image/webp"
              hidden
              ?disabled=${this.imageBusy}
              @change=${(e: Event) => void this.uploadImage(e)}
            />
            ${this.imageBusy ? msg('Working...') : msg('Upload image...')}
          </label>
          <button
            class="danger-btn"
            ?disabled=${this.imageBusy}
            @click=${() => (this.imageRemoveOpen = true)}
          >
            ${msg('Remove image...')}
          </button>
        </div>
      </section>

      ${this.basednConfirmOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.busy}
            confirmLabel=${msg('Change base DN')}
            message=${msg(
              str`Changing the LDAP base DN from "${this.info?.ldapBasedn ?? ''}" to "${this.ldapBasedn.trim()}" rebuilds the LDAP directory tree. Clients may need reconfiguration. Continue?`
            )}
            @confirm=${() => {
              this.basednConfirmOpen = false;
              void this.saveIdentity();
            }}
            @cancel=${() => (this.basednConfirmOpen = false)}
          ></confirm-dialog>`
        : nothing}
      ${this.imageRemoveOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.imageBusy}
            confirmLabel=${msg('Remove image')}
            message=${msg('Remove the domain image?')}
            @confirm=${() => void this.removeImage()}
            @cancel=${() => (this.imageRemoveOpen = false)}
          ></confirm-dialog>`
        : nothing}
    `;
  }

  static styles = domainPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'domain-page': DomainPage;
  }
}
