// Person detail: header (avatar initials, display name, spn, uuid) +
// tab bar routing to the sub-management tabs. Loads the person once
// and passes the id to each tab; tabs own their data loading.

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/avatar';
import '@/shared/components/ui-icon';
import '@/shared/components/tab-bar';
import type { TabDef } from '@/shared/components/tab-bar';
import './person-overview-tab';
import './person-credentials-tab';
import './person-sessions-tab';
import './person-ssh-tab';
import './person-posix-tab';
import './person-radius-tab';
import type { PersonDetail } from '../types/person.types';
import { personService } from '../services/person.service';
import { personDetailPageStyles } from './person-detail-page.styles';

const TABS: TabDef[] = [
  { id: 'overview', label: msg('Overview') },
  { id: 'credentials', label: msg('Credentials') },
  { id: 'sessions', label: msg('Sessions') },
  { id: 'ssh', label: msg('SSH keys') },
  { id: 'posix', label: msg('POSIX') },
  { id: 'radius', label: msg('RADIUS') },
];

@customElement('person-detail-page')
@localized()
export class PersonDetailPage extends LitElement {
  /** Person id (name or uuid) from the route param. */
  @property() id = '';

  @state() private person: PersonDetail | null = null;
  @state() private loading = true;
  @state() private notFound = false;
  @state() private activeTab = 'overview';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.notFound = false;
    try {
      this.person = await personService.get(this.id);
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'not_found' || error.status === 404)) {
        this.notFound = true;
      } else {
        notificationService.error(
          error instanceof ApiError ? error.message : msg('Failed to load person')
        );
      }
    } finally {
      this.loading = false;
    }
  }

  private handleTabChange(e: CustomEvent<{ id: string }>): void {
    this.activeTab = e.detail.id;
  }

  private renderTab(): ReturnType<typeof html> {
    switch (this.activeTab) {
      case 'credentials':
        return html`<person-credentials-tab .id=${this.id}></person-credentials-tab>`;
      case 'sessions':
        return html`<person-sessions-tab .id=${this.id}></person-sessions-tab>`;
      case 'ssh':
        return html`<person-ssh-tab .id=${this.id}></person-ssh-tab>`;
      case 'posix':
        return html`<person-posix-tab .id=${this.id}></person-posix-tab>`;
      case 'radius':
        return html`<person-radius-tab .id=${this.id}></person-radius-tab>`;
      default:
        return html`<person-overview-tab
          .id=${this.id}
          .person=${this.person}
          @person-changed=${() => void this.load()}
        ></person-overview-tab>`;
    }
  }

  render() {
    return html`
      <admin-layout>
        <a class="back" href="/admin/persons">
          <ui-icon name="chevron-right" size="14"></ui-icon>
          ${msg('All persons')}
        </a>
        ${this.loading
          ? html`<p class="muted">${msg('Loading...')}</p>`
          : this.notFound || !this.person
            ? html`<p class="muted">${msg('Person not found.')}</p>`
            : html`
                <header class="person-head">
                  <ui-avatar name=${this.person.displayName} size="48"></ui-avatar>
                  <div>
                    <h1>${this.person.displayName}</h1>
                    <p class="muted mono">${this.person.id}</p>
                    ${this.person.uuid
                      ? html`<p class="muted mono">${this.person.uuid}</p>`
                      : nothing}
                  </div>
                </header>
                <tab-bar
                  .tabs=${TABS}
                  .active=${this.activeTab}
                  @tab-change=${this.handleTabChange}
                ></tab-bar>
                <section class="tab-content">${this.renderTab()}</section>
              `}
      </admin-layout>
    `;
  }

  static styles = personDetailPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'person-detail-page': PersonDetailPage;
  }
}
