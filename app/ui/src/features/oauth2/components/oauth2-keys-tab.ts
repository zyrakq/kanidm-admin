// OAuth2 keys tab: rotate signing keys (with an optional rotation
// datetime, defaulting to now) and revoke a key by id. There is no
// list-keys endpoint (CLI parity), so the admin supplies the key id.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import { oauth2Service } from '../services/oauth2.service';

/** datetime-local value (UTC interpretation) → RFC3339, matching the
 * person-overview-tab helper. */
function toRfc3339(value: string): string {
  if (value.length === 16) {
    return `${value}:00Z`;
  }
  if (value.length === 19) {
    return `${value}Z`;
  }
  return value;
}

function nowLocalInput(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 16);
}

@customElement('oauth2-keys-tab')
@localized()
export class Oauth2KeysTab extends LitElement {
  /** Client id (name or uuid). */
  @property() id = '';

  @state() private rotateAt = nowLocalInput();
  @state() private rotateOpen = false;
  @state() private rotating = false;
  @state() private keyId = '';
  @state() private revokeOpen = false;
  @state() private revoking = false;

  private async rotateKeys(): Promise<void> {
    if (this.rotating) return;
    this.rotating = true;
    try {
      const rotateAt = this.rotateAt.trim();
      const iso =
        rotateAt !== '' ? toRfc3339(rotateAt) : toRfc3339(nowLocalInput());
      await authService.withStepUp(() => oauth2Service.rotateKeys(this.id, iso));
      this.rotateOpen = false;
      notificationService.success(msg('Key rotation scheduled.'));
    } catch {
      notificationService.error(msg('Failed to rotate the keys.'));
    } finally {
      this.rotating = false;
    }
  }

  private async revokeKey(): Promise<void> {
    const keyId = this.keyId.trim();
    if (!keyId || this.revoking) return;
    this.revoking = true;
    try {
      await authService.withStepUp(() => oauth2Service.revokeKey(this.id, keyId));
      this.revokeOpen = false;
      this.keyId = '';
      notificationService.success(msg('Key revoked.'));
    } catch {
      notificationService.error(msg('Failed to revoke the key.'));
    } finally {
      this.revoking = false;
    }
  }

  render() {
    return html`
      <ui-card class="card">
        <h2>${msg('Rotate signing keys')}</h2>
        <p class="muted">
          ${msg(
            'Generates a new signing key. Tokens signed with the old key stop working after the rotation time.'
          )}
        </p>
        <form-field
          field-id="keys-rotate-at"
          label=${msg('Rotate at')}
          type="datetime-local"
          .value=${this.rotateAt}
          hint=${msg('Defaults to now when left unchanged.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.rotateAt = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <ui-button
            variant="danger"
            ?disabled=${this.rotating}
            @click=${() => {
              this.rotateOpen = true;
            }}
          >
            ${msg('Rotate keys...')}
          </ui-button>
        </div>
      </ui-card>
      <ui-card class="card">
        <h2>${msg('Revoke key')}</h2>
        <p class="muted">
          ${msg(
            'Revokes a signing key by id. Tokens signed with it become invalid immediately.'
          )}
        </p>
        <form-field
          field-id="keys-key-id"
          label=${msg('Key id')}
          .value=${this.keyId}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.keyId = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <ui-button
            variant="danger"
            ?disabled=${this.keyId.trim() === '' || this.revoking}
            @click=${() => {
              this.revokeOpen = true;
            }}
          >
            ${msg('Revoke key...')}
          </ui-button>
        </div>
      </ui-card>
      ${this.rotateOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.rotating}
            confirmLabel=${msg('Rotate keys')}
            message=${msg(
              'Rotate the signing keys? Clients must fetch the new keys; tokens signed with the old key stop working after the rotation time.'
            )}
            @confirm=${() => void this.rotateKeys()}
            @cancel=${() => {
              this.rotateOpen = false;
            }}
          ></confirm-dialog>`
        : nothing}
      ${this.revokeOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.revoking}
            confirmLabel=${msg('Revoke key')}
            message=${msg(
              'Revoke this key? Tokens signed with it become invalid immediately.'
            )}
            @confirm=${() => void this.revokeKey()}
            @cancel=${() => {
              this.revokeOpen = false;
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
    'oauth2-keys-tab': Oauth2KeysTab;
  }
}
