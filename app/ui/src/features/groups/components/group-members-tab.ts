// Group members tab: member list with per-row Remove, an add-member
// form (person/service-account name, one at a time) and a "Set members"
// replace-all textarea hidden behind an advanced collapse. Mutations
// emit 'group-changed' so the container page reloads the detail.

import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import '@/shared/components/ui-card';
import '@/shared/components/ui-button';
import '@/shared/components/ui-empty-state';
import '@/shared/components/form-field';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { groupService } from '../services/group.service';
import type { GroupDetail } from '../types/group.types';

@customElement('group-members-tab')
@localized()
export class GroupMembersTab extends LitElement {
  /** Group id (name or uuid). */
  @property() id = '';

  /** Group detail from the container page. */
  @property({ attribute: false })
  detail: GroupDetail | null = null;

  @state() private removing: string | null = null;
  @state() private adding = false;
  @state() private setting = false;
  @state() private newMember = '';
  @state() private membersText = '';

  protected willUpdate(changed: PropertyValues): void {
    if (changed.has('detail')) {
      this.membersText = this.detail?.members.join('\n') ?? '';
    }
  }

  /** Tell the container page the group changed so it can reload. */
  private emitChanged(): void {
    this.dispatchEvent(
      new CustomEvent('group-changed', { bubbles: true, composed: true })
    );
  }

  private async removeMember(member: string): Promise<void> {
    if (this.removing) return;
    this.removing = member;
    try {
      await authService.withStepUp(() =>
        groupService.removeMembers(this.id, [member])
      );
      notificationService.success(msg('Member removed.'));
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to remove member.'));
    } finally {
      this.removing = null;
    }
  }

  private async addMember(): Promise<void> {
    const name = this.newMember.trim();
    if (!name || this.adding) return;
    this.adding = true;
    try {
      await authService.withStepUp(() => groupService.addMembers(this.id, [name]));
      notificationService.success(msg('Member added.'));
      this.newMember = '';
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to add member.'));
    } finally {
      this.adding = false;
    }
  }

  private async setMembers(): Promise<void> {
    if (this.setting) return;
    const members = this.membersText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    this.setting = true;
    try {
      await authService.withStepUp(() => groupService.setMembers(this.id, members));
      notificationService.success(msg('Members updated.'));
      this.emitChanged();
    } catch {
      notificationService.error(msg('Failed to set members.'));
    } finally {
      this.setting = false;
    }
  }

  render() {
    const detail = this.detail;
    if (!detail) {
      return html`<p class="muted">${msg('Group not available.')}</p>`;
    }
    const busy = this.removing !== null || this.adding || this.setting;
    return html`
      <ui-card>
        <h2 slot="header">${msg('Members')}</h2>
        ${detail.members.length === 0
          ? html`<ui-empty-state class="empty" icon="groups">
              ${msg('This group has no members.')}
            </ui-empty-state>`
          : html`
              <ul class="member-list">
                ${detail.members.map(
                  (member) => html`
                    <li>
                      <span class="mono">${member}</span>
                      <ui-button
                        variant="danger-ghost"
                        size="sm"
                        ?disabled=${busy}
                        ?loading=${this.removing === member}
                        @click=${() => this.removeMember(member)}
                      >
                        ${this.removing === member
                          ? msg('Removing...')
                          : msg('Remove')}
                      </ui-button>
                    </li>
                  `
                )}
              </ul>
            `}
        <div class="add-member">
          <form-field
            class="add-input"
            fieldId="group-add-member"
            placeholder=${msg('Person or service account name')}
            .value=${this.newMember}
            @field-input=${(e: CustomEvent<{ value: string }>) => {
              this.newMember = e.detail.value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void this.addMember();
              }
            }}
          ></form-field>
          <ui-button
            variant="primary"
            ?disabled=${busy || this.newMember.trim() === ''}
            ?loading=${this.adding}
            @click=${this.addMember}
          >
            ${this.adding ? msg('Adding...') : msg('Add member')}
          </ui-button>
        </div>
      </ui-card>
      <ui-card>
        <details class="advanced">
          <summary>${msg('Advanced: replace all members')}</summary>
          <p class="muted">
            ${msg(
              'One member name per line. Saving replaces the entire member list.'
            )}
          </p>
          <form-field
            class="members-textarea"
            fieldId="group-members-text"
            type="textarea"
            .rows=${6}
            .value=${this.membersText}
            @field-input=${(e: CustomEvent<{ value: string }>) => {
              this.membersText = e.detail.value;
            }}
          ></form-field>
          <div class="actions">
            <ui-button
              variant="primary"
              ?disabled=${busy}
              ?loading=${this.setting}
              @click=${this.setMembers}
            >
              ${this.setting ? msg('Saving...') : msg('Set members')}
            </ui-button>
          </div>
        </details>
      </ui-card>
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
    ui-card {
      margin-bottom: 16px;
    }
    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .empty {
      margin-bottom: 16px;
    }
    .member-list {
      list-style: none;
      margin: 0 0 16px;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .member-list li {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 8px 12px;
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-md);
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--theme-color-text-primary);
      word-break: break-all;
    }
    .add-member {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }
    .add-input {
      flex: 1;
      min-width: 0;
      --field-margin: 0;
    }
    .members-textarea {
      display: block;
      --field-margin: 0;
    }
    .advanced summary {
      margin-bottom: 12px;
      font-size: 14px;
      font-weight: 500;
      color: var(--theme-color-text-secondary);
      cursor: pointer;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'group-members-tab': GroupMembersTab;
  }
}
