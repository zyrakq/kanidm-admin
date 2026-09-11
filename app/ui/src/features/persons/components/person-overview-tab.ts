// Person overview tab: profile edit (display/legal name, mail),
// account validity (account_valid_from / account_expire datetime attrs)
// and group membership quick-ops. The person detail normally comes from
// the container page via the `person` property; when used standalone
// (person not provided) the tab self-loads it from its `id`.

import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { groupService, type GroupSummary } from '@/features/groups';
import { notificationService } from '@/features/notifications';
import { personService } from '../services/person.service';
import type { PersonDetail } from '../types/person.types';
import { personOverviewTabStyles } from './person-overview-tab.styles';
import { avatarUrl } from '@/shared/services/avatar-url';
import '@/shared/components/confirm-dialog';
import '@/shared/components/list-pager';

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

@customElement('person-overview-tab')
@localized()
export class PersonOverviewTab extends LitElement {
  /** Person id (name or uuid). */
  @property() id = '';

  /** Person detail from the container page (self-loaded when absent). */
  @property({ attribute: false })
  person: PersonDetail | null = null;

  @state() private loading = false;
  @state() private saving = false;
  @state() private savingValidity = false;
  @state() private addingGroup = false;
  @state() private removingGroup: string | null = null;
  @state() private groups: GroupSummary[] = [];
  @state() private memberPage = 1;
  @state() private memberPageSize = 10;
  @state() private avatarBusy = false;
  @state() private avatarRemoveOpen = false;
  @state() private avatarRemoving = false;
  @state() private avatarMissing = false;
  /** Cache-buster bumped after upload/remove to refresh the preview. */
  @state() private avatarVersion = 0;

  // Edit form state (synced from `person` unless the user has edits).
  @state() private displayName = '';
  @state() private legalName = '';
  @state() private mail = '';
  @state() private validFrom = '';
  @state() private expire = '';
  @state() private newGroup = '';
  private dirty = false;

  /** True when this tab loaded the person itself (no container value). */
  private selfLoaded = false;

  connectedCallback(): void {
    super.connectedCallback();
    groupService
      .list()
      .catch(() => [] as GroupSummary[])
      .then((groups) => (this.groups = groups));
    if (!this.person && this.id) {
      this.selfLoaded = true;
      void this.load();
    }
  }

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('person') && this.person && !this.dirty) {
      this.syncForm();
    }
  }

  private async load(): Promise<void> {
    if (!this.id) return;
    this.loading = true;
    try {
      this.person = await personService.get(this.id);
      this.dirty = false;
      this.syncForm();
    } catch {
      notificationService.error(msg('Failed to load person.'));
    } finally {
      this.loading = false;
    }
  }

  private syncForm(): void {
    const person = this.person;
    if (!person) return;
    this.displayName = person.displayName;
    this.legalName = person.legalName ?? '';
    this.mail = person.mail.join(', ');
    this.validFrom = toDatetimeLocal(person.accountValidFrom);
    this.expire = toDatetimeLocal(person.accountExpire);
  }

  private get personId(): string {
    return this.id || this.person?.id || '';
  }

  /** Tell the container page the person changed so it can reload. */
  private emitChanged(): void {
    this.dispatchEvent(
      new CustomEvent('person-changed', { bubbles: true, composed: true })
    );
  }

  /** Canonical avatar key: uuid when known (matches the session
   *  indicator's self-avatar), else the route id. */
  private get avatarKey(): string {
    return this.person?.uuid ?? this.personId;
  }

  private get avatarPreviewUrl(): string {
    return `${avatarUrl(this.avatarKey)}?v=${this.avatarVersion}`;
  }

  private async uploadAvatar(file: File): Promise<void> {
    if (this.avatarBusy) return;
    this.avatarBusy = true;
    try {
      await authService.withStepUp(() =>
        personService.setImage(this.avatarKey, file)
      );
      this.avatarMissing = false;
      this.avatarVersion += 1;
      notificationService.success(msg('Avatar uploaded.'));
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to upload the avatar.'));
    } finally {
      this.avatarBusy = false;
    }
  }

  private async removeAvatar(): Promise<void> {
    if (this.avatarRemoving) return;
    this.avatarRemoving = true;
    try {
      await authService.withStepUp(() =>
        personService.removeImage(this.avatarKey)
      );
      this.avatarRemoveOpen = false;
      this.avatarMissing = true;
      this.avatarVersion += 1;
      notificationService.success(msg('Avatar removed.'));
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to remove the avatar.'));
    } finally {
      this.avatarRemoving = false;
    }
  }

  private handleAvatarFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) {
      void this.uploadAvatar(file);
    }
  }

  /** Reload the person only when this tab owns the loading. */
  private async refreshPerson(): Promise<void> {
    if (this.selfLoaded) {
      await this.load();
    }
  }

  private setField(
    key: 'displayName' | 'legalName' | 'mail' | 'validFrom' | 'expire',
    value: string
  ): void {
    this.dirty = true;
    switch (key) {
      case 'displayName':
        this.displayName = value;
        break;
      case 'legalName':
        this.legalName = value;
        break;
      case 'mail':
        this.mail = value;
        break;
      case 'validFrom':
        this.validFrom = value;
        break;
      case 'expire':
        this.expire = value;
        break;
    }
  }

  private async saveProfile(): Promise<void> {
    const person = this.person;
    if (!person || this.saving) return;
    const changes: {
      displayName?: string;
      legalName?: string | null;
      mail?: string[];
    } = {};
    const displayName = this.displayName.trim();
    if (displayName !== person.displayName) {
      changes.displayName = displayName;
    }
    const legalName = this.legalName.trim();
    if (legalName !== (person.legalName ?? '')) {
      // '' purges the attribute (personService.update contract).
      changes.legalName = legalName;
    }
    const mail = this.mail
      .split(',')
      .map((address) => address.trim())
      .filter((address) => address !== '');
    if (JSON.stringify(mail) !== JSON.stringify(person.mail)) {
      changes.mail = mail;
    }
    if (Object.keys(changes).length === 0) {
      return;
    }
    this.saving = true;
    try {
      await authService.withStepUp(() =>
        personService.update(this.personId, changes)
      );
      notificationService.success(msg('Person updated.'));
      this.dirty = false;
      this.emitChanged();
      await this.refreshPerson();
    } catch {
      notificationService.error(msg('Failed to update person.'));
    } finally {
      this.saving = false;
    }
  }

  private async applyValidity(): Promise<void> {
    const person = this.person;
    if (!person || this.savingValidity) return;
    const operations: Promise<void>[] = [];
    if (this.validFrom !== toDatetimeLocal(person.accountValidFrom)) {
      operations.push(
        this.validFrom === ''
          ? personService.setAttr(this.personId, 'account_valid_from', [])
          : personService.setAttr(this.personId, 'account_valid_from', [
              toRfc3339(this.validFrom),
            ])
      );
    }
    if (this.expire !== toDatetimeLocal(person.accountExpire)) {
      operations.push(
        this.expire === ''
          ? personService.setAttr(this.personId, 'account_expire', [])
          : personService.setAttr(this.personId, 'account_expire', [
              toRfc3339(this.expire),
            ])
      );
    }
    if (operations.length === 0) {
      return;
    }
    this.savingValidity = true;
    try {
      await authService.withStepUp(() => Promise.all(operations));
      notificationService.success(msg('Account validity updated.'));
      this.emitChanged();
      await this.refreshPerson();
    } catch {
      notificationService.error(msg('Failed to update account validity.'));
    } finally {
      this.savingValidity = false;
    }
  }

  private async addGroup(): Promise<void> {
    const group = this.newGroup.trim();
    if (!group || this.addingGroup) return;
    this.addingGroup = true;
    try {
      await authService.withStepUp(() =>
        personService.addToGroup(group, this.personId)
      );
      notificationService.success(msg('Added to group.'));
      this.newGroup = '';
      this.emitChanged();
      await this.refreshPerson();
    } catch {
      notificationService.error(msg('Failed to add to group.'));
    } finally {
      this.addingGroup = false;
    }
  }

  private async removeGroup(group: string): Promise<void> {
    if (this.removingGroup) return;
    this.removingGroup = group;
    try {
      await authService.withStepUp(() =>
        personService.removeFromGroup(group, this.personId)
      );
      notificationService.success(msg('Removed from group.'));
      this.emitChanged();
      await this.refreshPerson();
    } catch {
      notificationService.error(msg('Failed to remove from group.'));
    } finally {
      this.removingGroup = null;
    }
  }

  private renderAvatarCard(): ReturnType<typeof html> {
    return html`
      <section class="card">
        <h2>${msg('Avatar')}</h2>
        <p class="muted">
          ${msg('Shown in person lists and the site header.')}
        </p>
        <div class="avatar-preview">
          ${this.avatarMissing
            ? html`<div class="avatar-placeholder">${msg('No image')}</div>`
            : html`<img
                src=${this.avatarPreviewUrl}
                alt=${msg('Avatar image')}
                @error=${() => {
                  this.avatarMissing = true;
                }}
              />`}
        </div>
        <div class="avatar-actions">
          <label class="primary-btn file-label">
            <input
              type="file"
              accept="image/*"
              @change=${this.handleAvatarFileChange}
            />
            ${this.avatarBusy ? msg('Uploading...') : msg('Upload image')}
          </label>
          <button
            class="danger-btn"
            type="button"
            ?disabled=${this.avatarMissing || this.avatarBusy}
            @click=${() => {
              this.avatarRemoveOpen = true;
            }}
          >
            ${msg('Remove image...')}
          </button>
        </div>
      </section>
      ${this.avatarRemoveOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.avatarRemoving}
            confirmLabel=${msg('Remove')}
            message=${msg('Remove the avatar?')}
            @confirm=${() => void this.removeAvatar()}
            @cancel=${() => {
              this.avatarRemoveOpen = false;
            }}
          ></confirm-dialog>`
        : nothing}
    `;
  }

  private renderProfile(): ReturnType<typeof html> {
    return html`
      <section class="card">
        <h2>${msg('Profile')}</h2>
        <form-field
          field-id="ov-displayname"
          label=${msg('Display name')}
          .value=${this.displayName}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            this.setField('displayName', e.detail.value)}
        ></form-field>
        <form-field
          field-id="ov-legalname"
          label=${msg('Legal name')}
          .value=${this.legalName}
          hint=${msg('Leave empty to remove the legal name.')}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            this.setField('legalName', e.detail.value)}
        ></form-field>
        <form-field
          field-id="ov-mail"
          label=${msg('Mail addresses')}
          .value=${this.mail}
          hint=${msg('Comma-separated list of mail addresses.')}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            this.setField('mail', e.detail.value)}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.saving}
            @click=${this.saveProfile}
          >
            ${this.saving ? msg('Saving...') : msg('Save')}
          </button>
        </div>
      </section>
    `;
  }

  private renderValidity(): ReturnType<typeof html> {
    return html`
      <section class="card">
        <h2>${msg('Account validity')}</h2>
        <form-field
          type="datetime-local"
          field-id="ov-valid-from"
          label=${msg('Valid from')}
          .value=${this.validFrom}
          hint=${msg('Empty value removes the restriction.')}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            this.setField('validFrom', e.detail.value)}
        ></form-field>
        <form-field
          type="datetime-local"
          field-id="ov-expire"
          label=${msg('Expires')}
          .value=${this.expire}
          hint=${msg('Empty value removes the expiry.')}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            this.setField('expire', e.detail.value)}
        ></form-field>
        <div class="actions">
          <button
            class="primary-btn"
            ?disabled=${this.savingValidity}
            @click=${this.applyValidity}
          >
            ${this.savingValidity ? msg('Applying...') : msg('Apply')}
          </button>
        </div>
      </section>
    `;
  }

  private renderGroups() {
    const person = this.person;
    if (!person) return nothing;
    const busy = this.addingGroup || this.removingGroup !== null;
    return html`
      <section class="card">
        <h2>${msg('Group membership')}</h2>
        ${person.memberOf.length === 0
          ? html`<p class="muted">${msg('Not a member of any group.')}</p>`
          : (() => {
              const total = person.memberOf.length;
              const pageCount = Math.max(
                1,
                Math.ceil(total / this.memberPageSize)
              );
              const page = Math.min(this.memberPage, pageCount);
              const pageGroups = person.memberOf.slice(
                (page - 1) * this.memberPageSize,
                page * this.memberPageSize
              );
              return html`
                <ul class="group-list">
                  ${pageGroups.map(
                    (group) => html`
                      <li>
                        <span class="mono">${group}</span>
                        <button
                          class="remove-btn"
                          ?disabled=${busy}
                          @click=${() => this.removeGroup(group)}
                        >
                          ${this.removingGroup === group
                            ? msg('Removing...')
                            : msg('Remove')}
                        </button>
                      </li>
                    `
                  )}
                </ul>
                <list-pager
                  .total=${total}
                  .page=${page}
                  .pageSize=${this.memberPageSize}
                  @page-change=${(e: CustomEvent<{ page: number }>) =>
                    (this.memberPage = e.detail.page)}
                  @page-size-change=${(
                    e: CustomEvent<{ pageSize: number }>
                  ) => {
                    this.memberPageSize = e.detail.pageSize;
                    this.memberPage = 1;
                  }}
                ></list-pager>
              `;
            })()}
        <div class="add-group">
          <form-field
            class="group-field"
            field-id="ov-new-group"
            type="combobox"
            placeholder=${msg('Select a group')}
            .value=${this.newGroup}
            .options=${this.groups.map((group) => ({
              value: group.id,
              label: group.displayName ?? group.id,
            }))}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              (this.newGroup = e.detail.value)}
          ></form-field>
          <button
            class="primary-btn"
            ?disabled=${busy || this.newGroup.trim() === ''}
            @click=${this.addGroup}
          >
            ${this.addingGroup ? msg('Adding...') : msg('Add')}
          </button>
        </div>
      </section>
    `;
  }

  render() {
    if (!this.person) {
      return html`<p class="muted">
        ${this.loading ? msg('Loading...') : msg('Person not available.')}
      </p>`;
    }
    return html`
      ${this.renderAvatarCard()}
      ${this.renderProfile()} ${this.renderValidity()} ${this.renderGroups()}
    `;
  }

  static styles = [
    personOverviewTabStyles,
    css`
      form-field {
        display: block;
      }

      .avatar-preview {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 160px;
        height: 160px;
        margin-bottom: 16px;
        border: 1px dashed var(--theme-color-border);
        border-radius: 8px;
        overflow: hidden;
        background: var(--theme-color-background);
      }
      .avatar-preview img {
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
      }
      .avatar-placeholder {
        font-size: 13px;
        color: var(--theme-color-text-muted);
      }
      .avatar-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
      }
      .file-label input[type='file'] {
        display: none;
      }
      .file-label {
        display: inline-block;
        text-align: center;
      }
      .danger-btn {
        padding: 9px 16px;
        border: none;
        border-radius: 6px;
        background: var(--theme-color-error);
        color: var(--theme-color-surface);
        font: inherit;
        font-weight: 500;
        cursor: pointer;
        transition: background-color 0.2s ease;
      }
      .danger-btn:hover:not(:disabled) {
        filter: brightness(0.9);
      }
      .danger-btn:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'person-overview-tab': PersonOverviewTab;
  }
}
