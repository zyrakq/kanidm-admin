// Person sessions tab: lists the account's active user auth tokens
// (vendor idm_account_list_user_auth_token) and lets an admin revoke
// them (idm_account_destroy_user_auth_token) with step-up auth.

import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/ui-button';
import { personService } from '../services/person.service';
import type { SessionItem } from '../types/person.types';

@customElement('person-sessions-tab')
@localized()
export class PersonSessionsTab extends LitElement {
  /** Person id (name or uuid). */
  @property() id = '';

  @state() private sessions: SessionItem[] = [];
  @state() private loading = false;
  @state() private revokingId: string | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    if (!this.id) return;
    this.loading = true;
    try {
      this.sessions = await personService.sessions(this.id);
    } catch {
      notificationService.error(msg('Failed to load sessions.'));
    } finally {
      this.loading = false;
    }
  }

  private async revoke(session: SessionItem): Promise<void> {
    this.revokingId = session.session_id;
    try {
      await authService.withStepUp(() =>
        personService.destroySession(this.id, session.session_id)
      );
      notificationService.success(msg('Session revoked.'));
      await this.load();
    } catch {
      notificationService.error(msg('Failed to revoke session.'));
    } finally {
      this.revokingId = null;
    }
  }

  private formatExpiry(session: SessionItem): string {
    if (session.state === 'revoked') {
      return msg('Revoked');
    }
    if (session.state === 'neverexpires') {
      return msg('Never expires');
    }
    const date = new Date(session.state.expiresat * 1000);
    return date.toLocaleString();
  }

  private formatIssued(session: SessionItem): string {
    return new Date(session.issued_at * 1000).toLocaleString();
  }

  /** Localized label for the wire purpose values. */
  private purposeLabel(purpose: string): string {
    switch (purpose) {
      case 'readonly':
        return msg('Read only');
      case 'readwrite':
        return msg('Read-write');
      case 'privilegecapable':
        return msg('Privilege capable');
      default:
        return purpose;
    }
  }

  render() {
    return html`
      <data-table
        .columns=${[
          {
            key: 'session_id',
            header: msg('Label'),
            render: (row: Record<string, unknown>) =>
              html`${String(row.session_id).slice(0, 8)}…`,
          },
          {
            key: 'issued',
            header: msg('Issued'),
            render: (row: Record<string, unknown>) =>
              this.formatIssued(row as unknown as SessionItem),
          },
          {
            key: 'expiry',
            header: msg('Expiry'),
            render: (row: Record<string, unknown>) =>
              this.formatExpiry(row as unknown as SessionItem),
          },
          {
            key: 'purpose',
            header: msg('Purpose'),
            render: (row: Record<string, unknown>) =>
              this.purposeLabel(String(row.purpose)),
          },
          {
            key: 'actions',
            header: '',
            render: (row: Record<string, unknown>) => html`
              <ui-button
                size="sm"
                variant="danger-ghost"
                ?disabled=${this.revokingId !== null}
                ?loading=${this.revokingId === row.session_id}
                @click=${() => this.revoke(row as unknown as SessionItem)}
              >
                ${this.revokingId === row.session_id
                  ? msg('Revoking...')
                  : msg('Revoke')}
              </ui-button>
            `,
          },
        ]}
        .rows=${this.sessions as unknown as Record<string, unknown>[]}
        ?loading=${this.loading}
        .emptyMessage=${msg('No active sessions.')}
      ></data-table>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'person-sessions-tab': PersonSessionsTab;
  }
}
