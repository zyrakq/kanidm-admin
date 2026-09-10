// Group members tab: member list with per-row Remove, an add-member
// form (person/service-account name, one at a time) and a "Set members"
// replace-all textarea hidden behind an advanced collapse. Mutations
// emit 'group-changed' so the container page reloads the detail.

import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
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
      <section class="card">
        <h2>${msg('Members')}</h2>
        ${detail.members.length === 0
          ? html`<p class="muted">${msg('This group has no members.')}</p>`
          : html`
              <ul class="member-list">
                ${detail.members.map(
                  (member) => html`
                    <li>
                      <span class="mono">${member}</span>
                      <button
                        class="remove-btn"
                        ?disabled=${busy}
                        @click=${() => this.removeMember(member)}
                      >
                        ${this.removing === member
                          ? msg('Removing...')
                          : msg('Remove')}
                      </button>
                    </li>
                  `
                )}
              </ul>
            `}
        <div class="add-member">
          <input
            class="input"
            placeholder=${msg('Person or service account name')}
            .value=${this.newMember}
            @input=${(e: Event) => {
              this.newMember = (e.target as HTMLInputElement).value;
            }}
            @keydown=${(e: KeyboardEvent) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void this.addMember();
              }
            }}
          />
          <button
            class="primary-btn"
            ?disabled=${busy || this.newMember.trim() === ''}
            @click=${this.addMember}
          >
            ${this.adding ? msg('Adding...') : msg('Add member')}
          </button>
        </div>
      </section>
      <section class="card">
        <details class="advanced">
          <summary>${msg('Advanced: replace all members')}</summary>
          <p class="muted">
            ${msg(
              'One member name per line. Saving replaces the entire member list.'
            )}
          </p>
          <textarea
            class="input members-textarea"
            rows="6"
            .value=${this.membersText}
            @input=${(e: Event) => {
              this.membersText = (e.target as HTMLTextAreaElement).value;
            }}
          ></textarea>
          <div class="actions">
            <button
              class="primary-btn"
              ?disabled=${busy}
              @click=${this.setMembers}
            >
              ${this.setting ? msg('Saving...') : msg('Set members')}
            </button>
          </div>
        </details>
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
      border-radius: 6px;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
      color: var(--theme-color-text-primary);
      word-break: break-all;
    }
    .remove-btn {
      flex-shrink: 0;
      padding: 4px 12px;
      border: 1px solid var(--theme-color-error);
      border-radius: 6px;
      background: transparent;
      color: var(--theme-color-error);
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .remove-btn:hover:not(:disabled) {
      background: var(--theme-color-error);
      color: var(--theme-color-surface);
    }
    .remove-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .add-member {
      display: flex;
      gap: 8px;
    }
    .input {
      flex: 1;
      min-width: 0;
      padding: 9px 12px;
      border: 1px solid var(--theme-color-border);
      border-radius: 6px;
      font: inherit;
      color: var(--theme-color-text-primary);
      background: var(--theme-color-surface);
      transition: border-color 0.2s ease;
    }
    .input:focus {
      outline: none;
      border-color: var(--theme-color-primary);
    }
    .members-textarea {
      display: block;
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 13px;
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
    'group-members-tab': GroupMembersTab;
  }
}
