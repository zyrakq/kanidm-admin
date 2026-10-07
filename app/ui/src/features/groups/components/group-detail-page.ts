// Group detail: header (badge, display name, id, uuid) + tab bar
// routing to the sub-management tabs. Loads the group once via
// groupService.get and passes id + detail to each tab; tabs emit
// 'group-changed' after mutations so the page can reload the detail.

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import { navigate } from '@/shared/services/router.service';
import '@/shared/components/admin-layout';
import '@/shared/components/ui-icon';
import '@/shared/components/ui-button';
import '@/shared/components/ui-skeleton';
import '@/shared/components/tab-bar';
import '@/shared/components/confirm-dialog';
import type { TabDef } from '@/shared/components/tab-bar';
import './group-members-tab';
import './group-settings-tab';
import './group-posix-tab';
import './group-account-policy-tab';
import type { GroupDetail } from '../types/group.types';
import { groupService } from '../services/group.service';
import { groupDetailPageStyles } from './group-detail-page.styles';

@customElement('group-detail-page')
@localized()
export class GroupDetailPage extends LitElement {
  /** Group id (name or uuid) from the route param. */
  @property() id = '';

  @state() private group: GroupDetail | null = null;
  @state() private loading = true;
  @state() private notFound = false;
  @state() private activeTab = 'members';
  @state() private deleteOpen = false;
  @state() private deleteBusy = false;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.notFound = false;
    try {
      this.group = await groupService.get(this.id);
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'not_found' || error.status === 404)) {
        this.notFound = true;
      } else {
        notificationService.error(
          error instanceof ApiError ? error.message : msg('Failed to load group')
        );
      }
    } finally {
      this.loading = false;
    }
  }

  private handleTabChange(e: CustomEvent<{ id: string }>): void {
    this.activeTab = e.detail.id;
  }

  private async submitDelete(): Promise<void> {
    if (!this.group) {
      return;
    }
    this.deleteBusy = true;
    try {
      const id = this.group.id;
      await authService.withStepUp(() => groupService.remove(id));
      notificationService.success(msg(str`Deleted group ${id}`));
      this.deleteOpen = false;
      navigate('/admin/groups');
    } catch (error) {
      notificationService.error(
        error instanceof ApiError ? error.message : msg('Failed to delete group')
      );
    } finally {
      this.deleteBusy = false;
    }
  }

  /** Any tab mutation: reload the detail. */
  private handleGroupChanged(): void {
    void this.load();
  }

  /**
   * Rename changes the group's name id: adopt the new id, sync the
   * address bar immediately (replace — the old URL is dead after a
   * rename) and reload.
   */
  private handleGroupRenamed(e: CustomEvent<{ newId: string }>): void {
    this.id = e.detail.newId;
    navigate(`/admin/groups/${encodeURIComponent(e.detail.newId)}`, {
      replace: true,
    });
    void this.load();
  }

  private renderTab(): ReturnType<typeof html> {
    switch (this.activeTab) {
      case 'settings':
        return html`<group-settings-tab
          .id=${this.id}
          .detail=${this.group}
          @group-changed=${this.handleGroupChanged}
          @group-renamed=${this.handleGroupRenamed}
        ></group-settings-tab>`;
      case 'posix':
        return html`<group-posix-tab
          .id=${this.id}
          .detail=${this.group}
          @group-changed=${this.handleGroupChanged}
        ></group-posix-tab>`;
      case 'account-policy':
        return html`<group-account-policy-tab
          .id=${this.id}
          .detail=${this.group}
          @group-changed=${this.handleGroupChanged}
        ></group-account-policy-tab>`;
      default:
        return html`<group-members-tab
          .id=${this.id}
          .detail=${this.group}
          @group-changed=${this.handleGroupChanged}
        ></group-members-tab>`;
    }
  }

  /** Built per render so labels re-evaluate msg() after locale switches. */
  private get tabs(): TabDef[] {
    return [
      { id: 'members', label: msg('Members') },
      { id: 'settings', label: msg('Settings') },
      { id: 'posix', label: msg('POSIX') },
      { id: 'account-policy', label: msg('Account Policy') },
    ];
  }

  render() {
    return html`
      <admin-layout>
        <a class="back" href="/admin/groups">
          <ui-icon name="chevron-right" size="14"></ui-icon>
          ${msg('All groups')}
        </a>
        ${this.loading
          ? html`<ui-skeleton lines="3"></ui-skeleton>`
          : this.notFound || !this.group
            ? html`<p class="muted">${msg('Group not found.')}</p>`
            : html`
                <header class="group-head">
                  <div class="group-badge">
                    <ui-icon name="groups" size="24"></ui-icon>
                  </div>
                  <div>
                    <h1>${this.group.displayName ?? this.group.id}</h1>
                    <p class="muted mono">${this.group.id}</p>
                    ${this.group.uuid
                      ? html`<p class="muted mono">${this.group.uuid}</p>`
                      : nothing}
                  </div>
                  <ui-button
                    class="btn-delete"
                    variant="danger-ghost"
                    icon="trash"
                    ?disabled=${this.deleteBusy}
                    @click=${() => (this.deleteOpen = true)}
                  >
                    ${msg('Delete')}
                  </ui-button>
                </header>
                <tab-bar
                  .tabs=${this.tabs}
                  .active=${this.activeTab}
                  @tab-change=${this.handleTabChange}
                ></tab-bar>
                <section class="tab-content">${this.renderTab()}</section>
              `}
        ${this.deleteOpen && this.group
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.deleteBusy}
                .danger=${true}
                .message=${msg(
                  str`Delete group "${this.group.displayName ?? this.group.id}" (${this.group.id})? The entry can be revived from the recycle bin.`
                )}
                .confirmLabel=${msg('Delete')}
                @cancel=${() => (this.deleteOpen = false)}
                @confirm=${() => void this.submitDelete()}
              ></confirm-dialog>
            `
          : nothing}
      </admin-layout>
    `;
  }

  static styles = groupDetailPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'group-detail-page': GroupDetailPage;
  }
}
