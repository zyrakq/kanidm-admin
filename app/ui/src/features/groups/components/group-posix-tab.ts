// Group POSIX tab: when the group is not POSIX-enabled, show an enable
// form (gidnumber optional) → groupService.unixExtend. When enabled,
// show the unix token details (gidnumber, spn, name) and allow editing
// the gidnumber (also via unixExtend).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { groupService } from '../services/group.service';
import type { GroupDetail } from '../types/group.types';

interface UnixGroupToken {
  name: string;
  spn: string;
  uuid: string;
  gidnumber: number;
}

@customElement('group-posix-tab')
@localized()
export class GroupPosixTab extends LitElement {
  /** Group id (name or uuid). */
  @property() id = '';

  /** Group detail from the container page (drives isPosix). */
  @property({ attribute: false })
  detail: GroupDetail | null = null;

  @state() private token: UnixGroupToken | null = null;
  @state() private tokenLoading = false;
  @state() private saving = false;
  @state() private gidnumber = '';

  private async loadToken(): Promise<void> {
    this.tokenLoading = true;
    try {
      this.token = await groupService.unixToken(this.id);
      this.gidnumber = String(this.token.gidnumber);
    } catch {
      this.token = null;
      notificationService.error(msg('Failed to load POSIX details.'));
    } finally {
      this.tokenLoading = false;
    }
  }

  private async savePosix(): Promise<void> {
    if (this.saving) return;
    const gid = this.gidnumber.trim() === '' ? undefined : Number(this.gidnumber);
    if (gid !== undefined && Number.isNaN(gid)) {
      notificationService.error(msg('GID number must be a number.'));
      return;
    }
    this.saving = true;
    try {
      await authService.withStepUp(() => groupService.unixExtend(this.id, gid));
      notificationService.success(msg('POSIX attributes saved.'));
      this.emitChanged();
      await this.loadToken();
    } catch {
      notificationService.error(msg('Failed to save POSIX attributes.'));
    } finally {
      this.saving = false;
    }
  }

  /** Tell the container page the group changed so it can reload. */
  private emitChanged(): void {
    this.dispatchEvent(
      new CustomEvent('group-changed', { bubbles: true, composed: true })
    );
  }

  private renderGidField(): unknown {
    return html`
      <form-field
        fieldId="posix-gidnumber"
        label=${msg('GID number')}
        type="number"
        .value=${this.gidnumber}
        hint=${msg('Leave empty to let the server pick one.')}
        @field-input=${(e: CustomEvent<{ value: string }>) => {
          this.gidnumber = e.detail.value;
        }}
      ></form-field>
    `;
  }

  render() {
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Group not available.')}</p>`;
    }
    if (!detail.isPosix) {
      return html`
        <p class="muted">${msg('This group is not POSIX-enabled.')}</p>
        <section class="card">
          <h2>${msg('Enable POSIX')}</h2>
          ${this.renderGidField()}
          <div class="actions">
            <button
              class="primary-btn"
              ?disabled=${this.saving}
              @click=${() => void this.savePosix()}
            >
              ${this.saving ? msg('Enabling...') : msg('Enable POSIX')}
            </button>
          </div>
        </section>
      `;
    }
    return html`
      <section class="card">
        <h2>${msg('POSIX details')}</h2>
        ${this.tokenLoading
          ? html`<p class="muted">${msg('Loading POSIX details...')}</p>`
          : this.token
            ? html`
                <dl class="token">
                  <div>
                    <dt>${msg('Name')}</dt>
                    <dd class="mono">${this.token.name}</dd>
                  </div>
                  <div>
                    <dt>${msg('SPN')}</dt>
                    <dd class="mono">${this.token.spn}</dd>
                  </div>
                  <div>
                    <dt>${msg('GID number')}</dt>
                    <dd class="mono">${this.token.gidnumber}</dd>
                  </div>
                  <div>
                    <dt>${msg('UUID')}</dt>
                    <dd class="mono">${this.token.uuid}</dd>
                  </div>
                </dl>
              `
            : nothing}
        ${this.renderGidField()}
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.saving}
            @click=${() => void this.savePosix()}
          >
            ${this.saving ? msg('Saving...') : msg('Save GID number')}
          </button>
        </div>
      </section>
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
    .token {
      margin: 0 0 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .token div {
      display: flex;
      gap: 12px;
      align-items: baseline;
    }
    .token dt {
      min-width: 110px;
      font-size: 14px;
      color: var(--theme-color-text-secondary);
    }
    .token dd {
      margin: 0;
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
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'group-posix-tab': GroupPosixTab;
  }
}
