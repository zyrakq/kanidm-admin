// Messages page: tab bar (All / Ready to send) over a data table, a
// "send test message" card, and a row-click detail modal with a
// "mark sent" confirm. Mutations wrapped in withStepUp (D8).

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/data-table';
import '@/shared/components/modal-dialog';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/tab-bar';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import '@/shared/components/ui-badge';
import '@/shared/components/ui-skeleton';
import type { TableColumn } from '@/shared/components/data-table';
import type { MessageDetail, MessageSummary } from '../types/message.types';
import { messageService } from '../services/message.service';
import { messagesPageStyles } from './messages-page.styles';

@customElement('messages-page')
@localized()
export class MessagesPage extends LitElement {
  @state() private messages: MessageSummary[] = [];
  @state() private loading = true;
  @state() private activeTab = 'all';
  @state() private detail: MessageDetail | null = null;
  @state() private detailLoading = false;
  @state() private markSentBusy = false;
  @state() private confirmOpen = false;
  @state() private sendTestBusy = false;
  @state() private sendTestPerson = '';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.messages =
        this.activeTab === 'ready'
          ? await messageService.listReady()
          : await messageService.list();
    } catch (error) {
      this.toastError(error, msg('Failed to load messages'));
    } finally {
      this.loading = false;
    }
  }

  private toastError(error: unknown, fallback: string): void {
    const message = error instanceof ApiError ? error.message : fallback;
    notificationService.error(message);
  }

  private handleTabChange(e: CustomEvent<{ id: string }>): void {
    this.activeTab = e.detail.id;
    void this.load();
  }

  private async openDetail(summary: MessageSummary): Promise<void> {
    this.detail = null;
    this.detailLoading = true;
    try {
      this.detail = await messageService.get(summary.id);
    } catch (error) {
      this.toastError(error, msg('Failed to load message'));
    } finally {
      this.detailLoading = false;
    }
  }

  private async submitMarkSent(): Promise<void> {
    if (!this.detail) {
      return;
    }
    this.markSentBusy = true;
    try {
      const id = this.detail.id;
      await authService.withStepUp(() => messageService.markSent(id));
      notificationService.success(msg(str`Marked message ${id} as sent`));
      this.confirmOpen = false;
      this.detail = null;
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to mark message as sent'));
    } finally {
      this.markSentBusy = false;
    }
  }

  private async submitSendTest(): Promise<void> {
    const person = this.sendTestPerson.trim();
    if (!person) {
      notificationService.error(msg('Person name is required.'));
      return;
    }
    this.sendTestBusy = true;
    try {
      await authService.withStepUp(() => messageService.sendTest(person));
      notificationService.success(
        msg(str`Queued a test message for ${person}`)
      );
      this.sendTestPerson = '';
      await this.load();
    } catch (error) {
      this.toastError(error, msg('Failed to send test message'));
    } finally {
      this.sendTestBusy = false;
    }
  }

  private get columns(): TableColumn[] {
    return [
      {
        key: 'id',
        header: msg('Id'),
        render: (row) => html`<span class="mono">${String(row.id)}</span>`,
      },
      { key: 'templateType', header: msg('Template') },
      { key: 'displayName', header: msg('Display name') },
      {
        key: 'sendAfter',
        header: msg('Send after'),
        render: (row) =>
          html`<span class="mono">${String(row.sendAfter)}</span>`,
      },
      {
        key: 'sentAt',
        header: msg('Sent'),
        render: (row) =>
          row.sentAt
            ? html`<ui-badge variant="success">${msg('Sent')}</ui-badge>`
            : html`<ui-badge>${msg('Pending')}</ui-badge>`,
      },
      { key: 'mailDestination', header: msg('Mail destination') },
    ];
  }

  private renderDetail(): unknown {
    if (this.detailLoading) {
      return html`<ui-skeleton height="20px" .lines=${4}></ui-skeleton>`;
    }
    if (!this.detail) {
      return nothing;
    }
    const detail = this.detail;
    return html`
      <dl class="detail-grid">
        <dt>${msg('Id')}</dt>
        <dd><span class="mono">${detail.id}</span></dd>
        <dt>${msg('Template')}</dt>
        <dd>${detail.templateType}</dd>
        <dt>${msg('Display name')}</dt>
        <dd>${detail.displayName}</dd>
        ${detail.intentId
          ? html`
              <dt>${msg('Intent id')}</dt>
              <dd><span class="mono">${detail.intentId}</span></dd>
            `
          : nothing}
        ${detail.expiryTime != null
          ? html`
              <dt>${msg('Expiry time')}</dt>
              <dd><span class="mono">${detail.expiryTime}</span></dd>
            `
          : nothing}
        <dt>${msg('Send after')}</dt>
        <dd><span class="mono">${detail.sendAfter}</span></dd>
        <dt>${msg('Delete after')}</dt>
        <dd><span class="mono">${detail.deleteAfter}</span></dd>
        <dt>${msg('Sent at')}</dt>
        <dd>
          ${detail.sentAt
            ? html`<span class="mono">${detail.sentAt}</span>`
            : msg('Not sent yet')}
        </dd>
        <dt>${msg('Mail destination')}</dt>
        <dd>
          ${detail.mailDestination.map(
            (mail) => html`<div class="mono">${mail.value}</div>`
          )}
        </dd>
      </dl>
    `;
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Messages')}</h1>
        </div>

        <tab-bar
          class="tabs"
          .tabs=${[
            { id: 'all', label: msg('All') },
            { id: 'ready', label: msg('Ready to send') },
          ]}
          .active=${this.activeTab}
          @tab-change=${this.handleTabChange}
        ></tab-bar>

        <ui-card class="send-test-card">
          <div class="send-test-row">
            <form-field
              label=${msg('Person name')}
              fieldId="message-send-test-person"
              .value=${this.sendTestPerson}
              placeholder="william"
              @field-input=${(e: CustomEvent<{ value: string }>) =>
                (this.sendTestPerson = e.detail.value)}
            ></form-field>
            <ui-button
              variant="primary"
              ?loading=${this.sendTestBusy}
              @click=${() => void this.submitSendTest()}
              icon="send"
            >
              ${msg('Send')}
            </ui-button>
          </div>
        </ui-card>

        <data-table
          .columns=${this.columns}
          .rows=${this.messages}
          .loading=${this.loading}
          .searchable=${true}
          .emptyMessage=${msg('No messages found.')}
          @row-click=${(e: CustomEvent<{ row: MessageSummary }>) =>
            void this.openDetail(e.detail.row)}
        ></data-table>

        <modal-dialog
          heading=${msg('Message detail')}
          .open=${this.detailLoading || this.detail !== null}
          .busy=${this.markSentBusy}
          @modal-close=${() => {
            this.detail = null;
            this.detailLoading = false;
          }}
        >
          ${this.renderDetail()}
          <div slot="footer">
            <ui-button
              ?disabled=${this.markSentBusy}
              @click=${() => (this.detail = null)}
            >
              ${msg('Close')}
            </ui-button>
            <ui-button
              variant="primary"
              ?disabled=${this.markSentBusy || !this.detail}
              @click=${() => (this.confirmOpen = true)}
            >
              ${msg('Mark sent')}
            </ui-button>
          </div>
        </modal-dialog>

        ${this.confirmOpen
          ? html`
              <confirm-dialog
                .open=${true}
                .busy=${this.markSentBusy}
                .message=${msg(
                  str`Mark message ${this.detail?.id ?? ''} as sent? No email will be delivered.`
                )}
                .confirmLabel=${msg('Mark sent')}
                @cancel=${() => (this.confirmOpen = false)}
                @confirm=${() => void this.submitMarkSent()}
              ></confirm-dialog>
            `
          : nothing}
      </admin-layout>
    `;
  }

  static styles = messagesPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'messages-page': MessagesPage;
  }
}
