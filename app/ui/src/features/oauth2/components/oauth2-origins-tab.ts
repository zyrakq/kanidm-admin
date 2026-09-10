// OAuth2 origins tab: lists the client's redirect origins with a
// remove action (confirm) and a form to add a new origin. Loads the
// detail itself via oauth2Service.get(id).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import { oauth2Service } from '../services/oauth2.service';
import type { Oauth2RsDetail } from '../types/oauth2.types';

@customElement('oauth2-origins-tab')
@localized()
export class Oauth2OriginsTab extends LitElement {
  /** Client id (name or uuid). */
  @property() id = '';

  @state() private detail: Oauth2RsDetail | null = null;
  @state() private loading = true;
  @state() private busy = false;
  @state() private origin = '';
  @state() private removeTarget: string | null = null;
  @state() private removing = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.detail = await oauth2Service.get(this.id);
    } catch {
      notificationService.error(msg('Failed to load origins.'));
    } finally {
      this.loading = false;
    }
  }

  private async addOrigin(): Promise<void> {
    const origin = this.origin.trim();
    if (!origin || this.busy) return;
    this.busy = true;
    try {
      await authService.withStepUp(() => oauth2Service.addOrigin(this.id, origin));
      this.origin = '';
      notificationService.success(msg('Origin added.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to add the origin.'));
    } finally {
      this.busy = false;
    }
  }

  private async removeOrigin(): Promise<void> {
    const origin = this.removeTarget;
    if (!origin || this.removing) return;
    this.removing = true;
    try {
      await authService.withStepUp(() => oauth2Service.removeOrigin(this.id, origin));
      this.removeTarget = null;
      notificationService.success(msg('Origin removed.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to remove the origin.'));
    } finally {
      this.removing = false;
    }
  }

  render() {
    if (this.loading) {
      return html`<p class="muted">${msg('Loading...')}</p>`;
    }
    const origins = this.detail?.origins ?? [];
    return html`
      <section class="card">
        <h2>${msg('Redirect origins')}</h2>
        <p class="muted">
          ${msg('Origins the client may redirect to after authentication.')}
        </p>
        ${origins.length === 0
          ? html`<p class="muted">${msg('No origins configured.')}</p>`
          : html`
              <table>
                <thead>
                  <tr>
                    <th>${msg('Origin')}</th>
                    <th class="col-actions">${msg('Actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  ${origins.map(
                    (origin) => html`
                      <tr>
                        <td class="mono">${origin}</td>
                        <td class="col-actions">
                          <button
                            class="remove-btn"
                            ?disabled=${this.busy}
                            @click=${() => {
                              this.removeTarget = origin;
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
            `}
      </section>
      <section class="card">
        <h2>${msg('Add origin')}</h2>
        <form-field
          field-id="org-origin"
          label=${msg('Origin URL')}
          .value=${this.origin}
          placeholder="https://app.example.com"
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.origin = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.origin.trim() === '' || this.busy}
            @click=${() => void this.addOrigin()}
          >
            ${this.busy ? msg('Adding...') : msg('Add origin')}
          </button>
        </div>
      </section>
      ${this.removeTarget !== null
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.removing}
            confirmLabel=${msg('Remove')}
            message=${msg(
              'Remove this origin? Clients redirecting to it will stop working.'
            )}
            @confirm=${() => void this.removeOrigin()}
            @cancel=${() => {
              this.removeTarget = null;
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
    'oauth2-origins-tab': Oauth2OriginsTab;
  }
}
