// Group settings tab: display name, description (set / purge), mail
// (comma-separated → array) and a rename form. Renaming changes the
// group's name id, so it requires an explicit confirm dialog warning;
// afterwards the tab emits 'group-renamed' with the new id.

import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import { groupService } from '../services/group.service';
import type { GroupDetail } from '../types/group.types';

@customElement('group-settings-tab')
@localized()
export class GroupSettingsTab extends LitElement {
  /** Group id (name or uuid). */
  @property() id = '';

  /** Group detail from the container page. */
  @property({ attribute: false })
  detail: GroupDetail | null = null;

  @state() private saving = false;
  @state() private renaming = false;
  @state() private renameOpen = false;

  // Form state (synced from `detail` unless the user has edits).
  @state() private displayName = '';
  @state() private description = '';
  @state() private mail = '';
  @state() private newName = '';
  private dirty = false;

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('detail') && this.detail && !this.dirty) {
      this.syncForm();
    }
  }

  private syncForm(): void {
    const detail = this.detail;
    if (!detail) return;
    this.displayName = detail.displayName ?? '';
    this.description = detail.description ?? '';
    this.mail = detail.mail.join(', ');
  }

  /** Tell the container page the group changed so it can reload. */
  private emitChanged(): void {
    this.dispatchEvent(
      new CustomEvent('group-changed', { bubbles: true, composed: true })
    );
  }

  private async saveSettings(): Promise<void> {
    const detail = this.detail;
    if (!detail || this.saving) return;
    const operations: Promise<void>[] = [];
    const displayName = this.displayName.trim();
    if (displayName !== (detail.displayName ?? '')) {
      operations.push(groupService.setDisplayName(this.id, displayName));
    }
    const description = this.description.trim();
    if (description !== (detail.description ?? '')) {
      operations.push(
        description === ''
          ? groupService.purgeDescription(this.id)
          : groupService.setDescription(this.id, description)
      );
    }
    const mail = this.mail
      .split(',')
      .map((address) => address.trim())
      .filter((address) => address !== '');
    if (JSON.stringify(mail) !== JSON.stringify(detail.mail)) {
      operations.push(groupService.setMail(this.id, mail));
    }
    if (operations.length === 0) {
      return;
    }
    this.saving = true;
    try {
      await authService.withStepUp(() => Promise.all(operations));
      notificationService.success(msg('Group settings saved.'));
      this.dirty = false;
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to save group settings.'));
    } finally {
      this.saving = false;
    }
  }

  private async confirmRename(): Promise<void> {
    const newName = this.newName.trim();
    if (!newName || this.renaming) return;
    this.renaming = true;
    try {
      await authService.withStepUp(() => groupService.rename(this.id, newName));
      notificationService.success(msg('Group renamed.'));
      this.renameOpen = false;
      this.newName = '';
      this.dirty = false;
      this.dispatchEvent(
        new CustomEvent('group-renamed', {
          bubbles: true,
          composed: true,
          detail: { newId: newName },
        })
      );
    } catch {
      notificationService.error(msg('Failed to rename group.'));
    } finally {
      this.renaming = false;
    }
  }

  render() {
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Group not available.')}</p>`;
    }
    return html`
      <section class="card">
        <h2>${msg('Settings')}</h2>
        <form-field
          field-id="grp-displayname"
          label=${msg('Display name')}
          .value=${this.displayName}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.displayName = e.detail.value;
          }}
        ></form-field>
        <form-field
          field-id="grp-description"
          label=${msg('Description')}
          .value=${this.description}
          hint=${msg('Leave empty to remove the description.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.description = e.detail.value;
          }}
        ></form-field>
        <form-field
          field-id="grp-mail"
          label=${msg('Mail addresses')}
          .value=${this.mail}
          hint=${msg('Comma-separated list of mail addresses.')}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.dirty = true;
            this.mail = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.saving}
            @click=${this.saveSettings}
          >
            ${this.saving ? msg('Saving...') : msg('Save')}
          </button>
        </div>
      </section>
      <section class="card">
        <h2>${msg('Rename group')}</h2>
        <p class="muted">
          ${msg('Current name')}:
          <span class="mono">${detail.id}</span>
        </p>
        <form-field
          field-id="grp-new-name"
          label=${msg('New name')}
          .value=${this.newName}
          @field-input=${(e: CustomEvent<{ value: string }>) => {
            this.newName = e.detail.value;
          }}
        ></form-field>
        <div class="actions">
          <button
            class="danger-btn"
            ?disabled=${this.newName.trim() === '' ||
            this.newName.trim() === detail.id}
            @click=${() => {
              this.renameOpen = true;
            }}
          >
            ${msg('Rename...')}
          </button>
        </div>
      </section>
      ${this.renameOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.renaming}
            confirmLabel=${msg('Rename')}
            message=${msg(
              'Renaming changes the group\'s name id. Memberships and references keep working, but the group will be reachable under the new name and the current URL becomes invalid. Continue?'
            )}
            @confirm=${() => void this.confirmRename()}
            @cancel=${() => {
              this.renameOpen = false;
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
    .actions {
      display: flex;
      justify-content: flex-end;
    }
    .primary-btn,
    .danger-btn {
      padding: 9px 16px;
      border: none;
      border-radius: 6px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
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
    .primary-btn:disabled,
    .danger-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'group-settings-tab': GroupSettingsTab;
  }
}
