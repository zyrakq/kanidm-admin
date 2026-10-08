// Service account POSIX (unix) tab: shows the account's unix token
// (vendor idm_account_unix_token_get — the shared /v1/account
// endpoint, same as persons). A 404 / not_found response means the
// account is not POSIX-enabled and only the Enable form is shown.
// Enable/Edit posts {shell, gidnumber}
// (idm_service_account_unix_extend); the unix password is set via the
// SingleStringRequest PUT on /_unix/_credential.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/ui-button';
import { serviceAccountService } from '../services/service-account.service';
import type { UnixUserTokenView } from '../types/service-account.types';

@customElement('sa-posix-tab')
@localized()
export class SaPosixTab extends LitElement {
  /** Service account id (name or uuid). */
  @property() id = '';

  @state() private token: UnixUserTokenView | null = null;
  /** null = still loading; false = confirmed not POSIX-enabled. */
  @state() private posixState: 'loading' | 'enabled' | 'disabled' = 'loading';
  @state() private saving = false;
  @state() private settingPassword = false;
  @state() private gidnumber = '';
  @state() private shell = '';
  @state() private password = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.id) return;
    this.posixState = 'loading';
    try {
      this.token = await serviceAccountService.posixShow(this.id);
      this.gidnumber =
        this.token.gidnumber !== undefined ? String(this.token.gidnumber) : '';
      this.shell = this.token.shell ?? '';
      this.posixState = 'enabled';
    } catch (error) {
      if (
        error instanceof ApiError &&
        (error.code === 'not_found' || error.status === 404)
      ) {
        this.token = null;
        this.gidnumber = '';
        this.shell = '';
        this.posixState = 'disabled';
      } else {
        notificationService.error(msg('Failed to load POSIX status.'));
        this.posixState = 'disabled';
      }
    }
  }

  private async savePosix(): Promise<void> {
    const gid = this.gidnumber.trim() === '' ? null : Number(this.gidnumber);
    const shell = this.shell.trim() === '' ? null : this.shell.trim();
    if (gid !== null && Number.isNaN(gid)) {
      notificationService.error(msg('GID number must be a number.'));
      return;
    }
    this.saving = true;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.posixSet(this.id, gid, shell)
      );
      notificationService.success(msg('POSIX attributes saved.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to save POSIX attributes.'));
    } finally {
      this.saving = false;
    }
  }

  private async setPassword(): Promise<void> {
    if (this.password === '') {
      notificationService.error(msg('Password must not be empty.'));
      return;
    }
    this.settingPassword = true;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.posixSetPassword(this.id, this.password)
      );
      notificationService.success(msg('POSIX password set.'));
      this.password = '';
    } catch {
      notificationService.error(msg('Failed to set POSIX password.'));
    } finally {
      this.settingPassword = false;
    }
  }

  private renderPosixForm(): unknown {
    return html`
      <form-field
        fieldId="sa-posix-gidnumber"
        label=${msg('GID number')}
        type="number"
        .value=${this.gidnumber}
        hint=${msg('Leave empty to let the server pick one.')}
        @field-input=${(e: CustomEvent<{ value: string }>) => {
          this.gidnumber = e.detail.value;
        }}
      ></form-field>
      <form-field
        fieldId="sa-posix-shell"
        label=${msg('Shell')}
        type="text"
        .value=${this.shell}
        placeholder="/bin/bash"
        hint=${msg('Leave empty to use the server default.')}
        @field-input=${(e: CustomEvent<{ value: string }>) => {
          this.shell = e.detail.value;
        }}
      ></form-field>
      <ui-button
        variant="primary"
        ?loading=${this.saving}
        @click=${() => void this.savePosix()}
      >
        ${msg('Save POSIX attributes')}
      </ui-button>
    `;
  }

  private renderPasswordForm(): unknown {
    return html`
      <section class="section">
        <h3>${msg('POSIX password')}</h3>
        <form-field
          fieldId="sa-posix-password"
          label=${msg('Password')}
          type="password"
          .value=${this.password}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.password = e.detail.value;
          }}
        ></form-field>
        <ui-button
          variant="primary"
          ?loading=${this.settingPassword}
          @click=${() => void this.setPassword()}
        >
          ${msg('Set POSIX password')}
        </ui-button>
      </section>
    `;
  }

  render() {
    if (this.posixState === 'loading') {
      return html`<p class="muted">${msg('Loading POSIX status...')}</p>`;
    }
    if (this.posixState === 'disabled') {
      return html`
        <p class="muted">${msg('This account is not POSIX-enabled.')}</p>
        <section class="section">
          <h3>${msg('Enable POSIX')}</h3>
          ${this.renderPosixForm()}
        </section>
      `;
    }
    return html`
      <section class="section">
        <h3>${msg('POSIX attributes')}</h3>
        ${this.token
          ? html`<p class="muted">
              ${msg('UUID')}: ${this.token.uuid} · ${msg('GID')}:
              ${this.token.gidnumber}
            </p>`
          : nothing}
        ${this.renderPosixForm()}
      </section>
      ${this.renderPasswordForm()}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .section {
      margin-bottom: 24px;
    }
    h3 {
      margin: 0 0 12px;
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .muted {
      margin: 0 0 12px;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-posix-tab': SaPosixTab;
  }
}
