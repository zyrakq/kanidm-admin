// Service account overview tab: profile edit (display name,
// description, mail), group membership quick-ops (via the group member
// attr endpoints, same as the persons overview) and the "Convert to
// person" action. The detail normally comes from the container page via
// the `sa` property; when used standalone the tab self-loads from `id`.

import { LitElement, css, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { apiFetch } from '@/shared/services/http-client';
import { navigate } from '@/shared/services/router.service';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import '@/shared/components/ui-skeleton';
import { serviceAccountService } from '../services/service-account.service';
import type { ServiceAccountDetail } from '../types/service-account.types';
import { saOverviewTabStyles } from './sa-overview-tab.styles';

@customElement('sa-overview-tab')
@localized()
export class SaOverviewTab extends LitElement {
  /** Service account id (name or uuid). */
  @property() id = '';

  /** Detail from the container page (self-loaded when absent). */
  @property({ attribute: false })
  sa: ServiceAccountDetail | null = null;

  @state() private loading = false;
  @state() private saving = false;
  @state() private addingGroup = false;
  @state() private removingGroup: string | null = null;
  @state() private converting = false;
  @state() private confirmOpen = false;

  // Edit form state (synced from `sa` unless the user has edits).
  @state() private displayName = '';
  @state() private description = '';
  @state() private mail = '';
  @state() private newGroup = '';
  private dirty = false;

  /** True when this tab loaded the detail itself (no container value). */
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
    this.displayName = sa.displayName;
    this.description = sa.description ?? '';
    this.mail = sa.mail.join(', ');
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

  /** Reload the detail only when this tab owns the loading. */
  private async refreshSa(): Promise<void> {
    if (this.selfLoaded) {
      await this.load();
    }
  }

  private setField(
    key: 'displayName' | 'description' | 'mail',
    value: string
  ): void {
    this.dirty = true;
    switch (key) {
      case 'displayName':
        this.displayName = value;
        break;
      case 'description':
        this.description = value;
        break;
      case 'mail':
        this.mail = value;
        break;
    }
  }

  private async saveProfile(): Promise<void> {
    const sa = this.sa;
    if (!sa || this.saving) return;
    const changes: {
      displayName?: string;
      description?: string | null;
      mail?: string[];
    } = {};
    const displayName = this.displayName.trim();
    if (displayName !== sa.displayName) {
      changes.displayName = displayName;
    }
    const description = this.description.trim();
    if (description !== (sa.description ?? '')) {
      // '' purges the attribute (serviceAccountService.update contract).
      changes.description = description;
    }
    const mail = this.mail
      .split(',')
      .map((address) => address.trim())
      .filter((address) => address !== '');
    if (JSON.stringify(mail) !== JSON.stringify(sa.mail)) {
      changes.mail = mail;
    }
    if (Object.keys(changes).length === 0) {
      return;
    }
    this.saving = true;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.update(this.saId, changes)
      );
      notificationService.success(msg('Service account updated.'));
      this.dirty = false;
      this.emitChanged();
      await this.refreshSa();
    } catch {
      notificationService.error(msg('Failed to update service account.'));
    } finally {
      this.saving = false;
    }
  }

  /** Group membership quick-ops via group attr endpoints (same as the
   * persons overview: POST appends, DELETE-with-body removes). */
  private addToGroup(groupId: string, saId: string): Promise<void> {
    return apiFetch<void>(
      `/api/kanidm/v1/group/${encodeURIComponent(groupId)}/_attr/member`,
      { method: 'POST', body: JSON.stringify([saId]) }
    );
  }

  private removeFromGroup(groupId: string, saId: string): Promise<void> {
    return apiFetch<void>(
      `/api/kanidm/v1/group/${encodeURIComponent(groupId)}/_attr/member`,
      { method: 'DELETE', body: JSON.stringify([saId]) }
    );
  }

  private async addGroup(): Promise<void> {
    const group = this.newGroup.trim();
    if (!group || this.addingGroup) return;
    this.addingGroup = true;
    try {
      await authService.withStepUp(() => this.addToGroup(group, this.saId));
      notificationService.success(msg('Added to group.'));
      this.newGroup = '';
      this.emitChanged();
      await this.refreshSa();
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
        this.removeFromGroup(group, this.saId)
      );
      notificationService.success(msg('Removed from group.'));
      this.emitChanged();
      await this.refreshSa();
    } catch {
      notificationService.error(msg('Failed to remove from group.'));
    } finally {
      this.removingGroup = null;
    }
  }

  private openConfirm(): void {
    this.confirmOpen = true;
  }

  private closeConfirm(): void {
    this.confirmOpen = false;
  }

  private async convertToPerson(): Promise<void> {
    if (this.converting) return;
    this.converting = true;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.intoPerson(this.saId)
      );
      notificationService.success(msg('Converted to person.'));
      this.confirmOpen = false;
      // The service account no longer exists; land on the new person.
      navigate(`/admin/persons/${encodeURIComponent(this.saId)}`);
    } catch {
      notificationService.error(msg('Failed to convert to person.'));
      this.converting = false;
    }
  }

  private renderProfile(): ReturnType<typeof html> {
    return html`
      <ui-card
        ><section>
          <h2>${msg('Profile')}</h2>
          <form-field
            field-id="sa-displayname"
            label=${msg('Display name')}
            .value=${this.displayName}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              this.setField('displayName', e.detail.value)}
          ></form-field>
          <form-field
            field-id="sa-description"
            label=${msg('Description')}
            .value=${this.description}
            hint=${msg('Leave empty to remove the description.')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              this.setField('description', e.detail.value)}
          ></form-field>
          <form-field
            field-id="sa-mail"
            label=${msg('Mail addresses')}
            .value=${this.mail}
            hint=${msg('Comma-separated list of mail addresses.')}
            @field-input=${(e: CustomEvent<{ value: string }>) =>
              this.setField('mail', e.detail.value)}
          ></form-field>
          <div class="actions">
            <ui-button
              variant="primary"
              ?loading=${this.saving}
              @click=${this.saveProfile}
            >
              ${msg('Save')}
            </ui-button>
          </div>
        </section></ui-card
      >
    `;
  }

  private renderGroups() {
    const sa = this.sa;
    if (!sa) return nothing;
    const busy = this.addingGroup || this.removingGroup !== null;
    return html`
      <ui-card
        ><section>
          <h2>${msg('Group membership')}</h2>
          ${sa.memberOf.length === 0
            ? html`<p class="muted">${msg('Not a member of any group.')}</p>`
            : html`
                <ul class="group-list">
                  ${sa.memberOf.map(
                    (group) => html`
                      <li>
                        <span class="mono">${group}</span>
                        <ui-button
                          size="sm"
                          variant="danger-ghost"
                          ?disabled=${busy}
                          ?loading=${this.removingGroup === group}
                          @click=${() => this.removeGroup(group)}
                        >
                          ${this.removingGroup === group
                            ? msg('Removing...')
                            : msg('Remove')}
                        </ui-button>
                      </li>
                    `
                  )}
                </ul>
              `}
          <div class="add-group">
            <form-field
              field-id="sa-new-group"
              placeholder=${msg('Group name or uuid')}
              .value=${this.newGroup}
              @field-input=${(e: CustomEvent<{ value: string }>) => {
                this.newGroup = e.detail.value;
              }}
              @keydown=${(e: KeyboardEvent) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  void this.addGroup();
                }
              }}
            ></form-field>
            <ui-button
              variant="primary"
              icon="plus"
              ?disabled=${busy || this.newGroup.trim() === ''}
              ?loading=${this.addingGroup}
              @click=${this.addGroup}
            >
              ${msg('Add')}
            </ui-button>
          </div>
        </section></ui-card
      >
    `;
  }

  private renderConvert(): ReturnType<typeof html> {
    return html`
      <ui-card
        ><section>
          <h2>${msg('Convert to person')}</h2>
          <p class="muted">
            ${msg(
              'Turns this service account into a regular person account. This cannot be undone.'
            )}
          </p>
          <div class="actions">
            <ui-button variant="danger-ghost" @click=${this.openConfirm}>
              ${msg('Convert to person')}
            </ui-button>
          </div>
        </section></ui-card
      >
    `;
  }

  private renderConfirmModal() {
    if (!this.confirmOpen) {
      return nothing;
    }
    return html`
      <confirm-dialog
        .open=${true}
        .busy=${this.converting}
        .message=${msg(
          'Convert this service account into a person account? You will be taken to the person page.'
        )}
        .confirmLabel=${msg('Convert')}
        @cancel=${this.closeConfirm}
        @confirm=${() => void this.convertToPerson()}
      ></confirm-dialog>
    `;
  }

  render() {
    if (!this.sa) {
      return this.loading
        ? html`<ui-skeleton height="56px" .lines=${2}></ui-skeleton>`
        : html`<p class="muted">${msg('Service account not available.')}</p>`;
    }
    return html`
      ${this.renderProfile()} ${this.renderGroups()} ${this.renderConvert()}
      ${this.renderConfirmModal()}
    `;
  }

  static styles = [
    saOverviewTabStyles,
    css`
      form-field {
        display: block;
      }
    `,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-overview-tab': SaOverviewTab;
  }
}
