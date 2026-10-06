// OAuth2 settings tab: display name, landing origin, basic secret
// (reveal-once / reset with confirm), refresh-token expiry and the
// security toggle rows. Receives the loaded detail from the container
// page and emits 'oauth2-changed' after successful mutations.

import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import { oauth2Service } from '../services/oauth2.service';
import type { Oauth2RsDetail } from '../types/oauth2.types';

@customElement('oauth2-settings-tab')
@localized()
export class Oauth2SettingsTab extends LitElement {
  /** Client id (name or uuid). */
  @property() id = '';

  /** Client detail from the container page. */
  @property({ attribute: false })
  detail: Oauth2RsDetail | null = null;

  @state() private saving = false;
  @state() private busy = false;

  // Secret card state.
  @state() private secret: string | null = null;
  @state() private secretLoading = false;
  @state() private resetOpen = false;
  @state() private resetting = false;
  @state() private copied = false;

  // Refresh-token expiry form state.
  @state() private expiryInput = '';
  private expiryDirty = false;

  // General form state (synced from `detail` unless the user has edits).
  @state() private displayName = '';
  @state() private landing = '';
  private dirty = false;

  // Toggle confirm state (dangerous directions).
  @state() private pkceConfirmOpen = false;
  @state() private legacyConfirmOpen = false;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('detail') && this.detail) {
      if (!this.expiryDirty) {
        this.expiryInput =
          this.detail.refreshTokenExpiry !== null
            ? String(this.detail.refreshTokenExpiry)
            : '';
      }
      if (!this.dirty) {
        this.displayName = this.detail.displayName;
        this.landing = this.detail.landingOrigin ?? '';
      }
    }
  }

  /** Tell the container page the client changed so it can reload. */
  private emitChanged(): void {
    this.dispatchEvent(
      new CustomEvent('oauth2-changed', { bubbles: true, composed: true })
    );
  }

  private async saveBasics(): Promise<void> {
    const detail = this.detail;
    if (!detail || this.saving) return;
    const displayName = this.displayName.trim();
    const landing = this.landing.trim();
    const operations: Promise<void>[] = [];
    if (displayName !== '' && displayName !== detail.displayName) {
      operations.push(oauth2Service.update(this.id, { displayName }));
    }
    if (landing !== '' && landing !== (detail.landingOrigin ?? '')) {
      operations.push(oauth2Service.update(this.id, { landing }));
    }
    if (operations.length === 0) return;
    this.saving = true;
    try {
      await authService.withStepUp(() => Promise.all(operations));
      notificationService.success(msg('Settings saved.'));
      this.dirty = false;
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to save settings.'));
    } finally {
      this.saving = false;
    }
  }

  private async showSecret(): Promise<void> {
    this.secretLoading = true;
    try {
      this.secret = await oauth2Service.getBasicSecret(this.id);
      if (this.secret === null) {
        notificationService.error(msg('No basic secret available.'));
      }
      this.copied = false;
    } catch {
      notificationService.error(msg('Failed to load the secret.'));
    } finally {
      this.secretLoading = false;
    }
  }

  private async copySecret(): Promise<void> {
    if (!this.secret) return;
    try {
      await navigator.clipboard.writeText(this.secret);
      this.copied = true;
    } catch {
      notificationService.error(msg('Failed to copy to clipboard.'));
    }
  }

  private async resetSecret(): Promise<void> {
    if (this.resetting) return;
    this.resetting = true;
    try {
      await authService.withStepUp(() =>
        oauth2Service.update(this.id, { resetSecret: true })
      );
      this.secret = await oauth2Service.getBasicSecret(this.id);
      this.copied = false;
      this.resetOpen = false;
      notificationService.success(msg('New secret generated. Store it now — it is shown only once.'));
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to reset the secret.'));
    } finally {
      this.resetting = false;
    }
  }

  private async saveExpiry(): Promise<void> {
    if (this.busy) return;
    const raw = this.expiryInput.trim();
    const seconds = raw === '' ? null : Number(raw);
    if (raw !== '' && (!Number.isFinite(seconds) || (seconds as number) < 0)) {
      notificationService.error(msg('Enter a non-negative number of seconds.'));
      return;
    }
    this.busy = true;
    try {
      await authService.withStepUp(() =>
        oauth2Service.setRefreshTokenExpiry(this.id, seconds)
      );
      this.expiryDirty = false;
      notificationService.success(msg('Refresh token expiry updated.'));
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to update the refresh token expiry.'));
    } finally {
      this.busy = false;
    }
  }

  private async toggle(
    run: () => Promise<void>,
    failMessage: string
  ): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await authService.withStepUp(run);
      notificationService.success(msg('Setting updated.'));
      this.emitChanged();
    } catch {
      notificationService.error(failMessage);
    } finally {
      this.busy = false;
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
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Client not available.')}</p>`;
    }
    return html`
      ${detail.isPublic
        ? nothing
        : html`
            <ui-card><section>
              <h2>${msg('Basic secret')}</h2>
              <p class="muted">
                ${msg(
                  'Used for the client-credentials flow. Shown only when requested — store it in a safe place.'
                )}
              </p>
              ${this.secret !== null
                ? html`
                    <div class="secret-row">
                      <code class="mono">${this.secret}</code>
                      <ui-button
                        variant="secondary"
                        size="sm"
                        @click=${() => void this.copySecret()}
                      >
                        ${this.copied ? msg('Copied!') : msg('Copy')}
                      </ui-button>
                    </div>
                  `
                : html`
                    <div class="actions">
                      <ui-button
                        variant="secondary"
                        ?loading=${this.secretLoading}
                        @click=${() => void this.showSecret()}
                      >
                        ${msg('Show secret')}
                      </ui-button>
                      <ui-button
                        variant="danger"
                        @click=${() => {
                          this.resetOpen = true;
                        }}
                      >
                        ${msg('Reset secret...')}
                      </ui-button>
                    </div>
                  `}
            </section></ui-card>
          `}
      <ui-card><section>
        <h2>${msg('General')}</h2>
        <form-field
          field-id="set-displayname"
          label=${msg('Display name')}
          .value=${this.displayName}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.displayName = e.detail.value;
          }}
        ></form-field>
        <form-field
          field-id="set-landing"
          label=${msg('Landing origin')}
          .value=${this.landing}
          hint=${msg('Where the user is redirected after login.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.landing = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <ui-button
            variant="primary"
            ?loading=${this.saving}
            @click=${() => void this.saveBasics()}
          >
            ${msg('Save')}
          </ui-button>
        </div>
      </section></ui-card>
      <ui-card><section>
        <h2>${msg('Tokens')}</h2>
        <form-field
          field-id="set-expiry"
          label=${msg('Refresh token expiry (seconds)')}
          type="number"
          .value=${this.expiryInput}
          hint=${msg('Leave empty for no expiry.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.expiryDirty = true;
            this.expiryInput = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <ui-button
            variant="secondary"
            ?disabled=${this.busy}
            @click=${() => {
              this.expiryInput = '';
              this.expiryDirty = true;
              void this.saveExpiry();
            }}
          >
            ${msg('Clear')}
          </ui-button>
          <ui-button
            variant="primary"
            ?loading=${this.busy}
            @click=${() => void this.saveExpiry()}
          >
            ${msg('Save')}
          </ui-button>
        </div>
      </section></ui-card>
      <ui-card><section>
        <h2>${msg('Security')}</h2>
        ${this.renderToggleRow(
          msg('Strict redirect URI validation'),
          msg('Only exact redirect origins are accepted.'),
          detail.strictRedirect,
          () => {
            const next = !detail.strictRedirect;
                          void this.toggle(
              () =>
                next
                  ? oauth2Service.enableStrictRedirect(this.id)
                  : oauth2Service.disableStrictRedirect(this.id),
              msg('Failed to update strict redirect validation.')
            );
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('PKCE'),
          msg('Proof Key for Code Exchange. Disabling is insecure.'),
          !detail.pkceDisabled,
          () => {
            if (detail.pkceDisabled) {
                              void this.toggle(
                () => oauth2Service.enablePkce(this.id),
                msg('Failed to enable PKCE.')
              );
            } else {
              this.pkceConfirmOpen = true;
            }
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('Allow localhost redirects'),
          msg('Permit loopback redirects for native apps.'),
          detail.localhostRedirect,
          () => {
            const next = !detail.localhostRedirect;
                          void this.toggle(
              () =>
                next
                  ? oauth2Service.enableLocalhostRedirect(this.id)
                  : oauth2Service.disableLocalhostRedirect(this.id),
              msg('Failed to update localhost redirects.')
            );
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('Legacy crypto'),
          msg('Allow legacy signing algorithms. Enabling is insecure.'),
          detail.legacyCrypto,
          () => {
            if (detail.legacyCrypto) {
                              void this.toggle(
                () => oauth2Service.disableLegacyCrypto(this.id),
                msg('Failed to disable legacy crypto.')
              );
            } else {
              this.legacyConfirmOpen = true;
            }
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('Prefer short username'),
          msg('Use the name instead of the spn in tokens.'),
          detail.preferShortUsername,
          () => {
            const next = !detail.preferShortUsername;
                          void this.toggle(
              () =>
                next
                  ? oauth2Service.preferShortUsername(this.id)
                  : oauth2Service.preferSpnUsername(this.id),
              msg('Failed to update username preference.')
            );
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('Consent prompt'),
          msg('Ask the user to confirm access on each login.'),
          detail.consentPrompt,
          () => {
            const next = !detail.consentPrompt;
                          void this.toggle(
              () =>
                next
                  ? oauth2Service.enableConsentPrompt(this.id)
                  : oauth2Service.disableConsentPrompt(this.id),
              msg('Failed to update the consent prompt.')
            );
          },
          this.busy
        )}
        ${this.renderToggleRow(
          msg('Device flow'),
          msg('Allow sign-in on input-limited devices.'),
          detail.deviceFlow,
          () => {
            const next = !detail.deviceFlow;
                          void this.toggle(
              () => oauth2Service.setDeviceFlow(this.id, next),
              msg('Failed to update the device flow.')
            );
          },
          this.busy
        )}
      </section></ui-card>
      ${this.resetOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.resetting}
            confirmLabel=${msg('Reset secret')}
            message=${msg(
              'Resetting invalidates the current basic secret immediately. Clients using it will no longer be able to authenticate. Continue?'
            )}
            @confirm=${() => void this.resetSecret()}
            @cancel=${() => {
              this.resetOpen = false;
            }}
          ></confirm-dialog>`
        : nothing}
      ${this.pkceConfirmOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.busy}
            confirmLabel=${msg('Disable PKCE')}
            message=${msg(
              'Disabling PKCE removes replay protection for the authorization code flow and is insecure. Continue?'
            )}
            @confirm=${() => {
              this.pkceConfirmOpen = false;
                              void this.toggle(
                () => oauth2Service.disablePkce(this.id),
                msg('Failed to disable PKCE.')
              );
            }}
            @cancel=${() => {
              this.pkceConfirmOpen = false;
            }}
          ></confirm-dialog>`
        : nothing}
      ${this.legacyConfirmOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.busy}
            confirmLabel=${msg('Enable legacy crypto')}
            message=${msg(
              'Legacy crypto allows weaker signing algorithms and is insecure. Continue?'
            )}
            @confirm=${() => {
              this.legacyConfirmOpen = false;
                              void this.toggle(
                () => oauth2Service.enableLegacyCrypto(this.id),
                msg('Failed to enable legacy crypto.')
              );
            }}
            @cancel=${() => {
              this.legacyConfirmOpen = false;
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
    ui-card {
      display: block;
      margin-bottom: 16px;
    }
    section h2 {
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
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    .secret-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .secret-row code {
      flex: 1;
      background: var(--theme-color-background);
      border: 1px solid var(--theme-color-border);
      border-radius: 6px;
      padding: 10px 12px;
    }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 12px 0;
      border-bottom: 1px solid var(--theme-color-border);
    }
    .toggle-row:last-child {
      border-bottom: none;
    }
    .toggle-text {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .toggle-label {
      font-weight: 500;
      color: var(--theme-color-text-primary);
    }
    .toggle-text .muted {
      margin: 0;
      font-size: 13px;
    }
    .switch {
      position: relative;
      display: inline-block;
      width: 40px;
      height: 22px;
      flex-shrink: 0;
    }
    .switch input {
      opacity: 0;
      width: 0;
      height: 0;
    }
    .slider {
      position: absolute;
      inset: 0;
      background: var(--theme-color-border);
      border-radius: 22px;
      transition: background-color 0.2s ease;
    }
    .slider::before {
      content: '';
      position: absolute;
      width: 16px;
      height: 16px;
      left: 3px;
      top: 3px;
      border-radius: 50%;
      background: var(--theme-color-surface);
      transition: transform 0.2s ease;
    }
    .switch input:checked + .slider {
      background: var(--theme-color-primary);
    }
    .switch input:checked + .slider::before {
      transform: translateX(18px);
    }
    .switch input:disabled + .slider {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth2-settings-tab': Oauth2SettingsTab;
  }
}
