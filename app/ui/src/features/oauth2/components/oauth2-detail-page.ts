// OAuth2 client detail: header (display name, id, uuid) + tab bar
// routing to the sub-management tabs. Loads the client once and passes
// the id to each tab; the settings tab also receives the detail and
// emits 'oauth2-changed' so the page can reload after mutations.

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import { ApiError } from '@/shared/services/http-client';
import '@/shared/components/admin-layout';
import '@/shared/components/ui-icon';
import '@/shared/components/tab-bar';
import type { TabDef } from '@/shared/components/tab-bar';
import './oauth2-settings-tab';
import './oauth2-origins-tab';
import './oauth2-scope-maps-tab';
import './oauth2-claim-maps-tab';
import './oauth2-image-tab';
import './oauth2-keys-tab';
import type { Oauth2RsDetail } from '../types/oauth2.types';
import { oauth2Service } from '../services/oauth2.service';
import { oauth2DetailPageStyles } from './oauth2-detail-page.styles';

@customElement('oauth2-detail-page')
@localized()
export class Oauth2DetailPage extends LitElement {
  /** Client id (name or uuid) from the route param. */
  @property() id = '';

  @state() private detail: Oauth2RsDetail | null = null;
  @state() private loading = true;
  @state() private notFound = false;
  @state() private activeTab = 'settings';

  connectedCallback(): void {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    this.notFound = false;
    try {
      this.detail = await oauth2Service.get(this.id);
    } catch (error) {
      if (error instanceof ApiError && (error.code === 'not_found' || error.status === 404)) {
        this.notFound = true;
      } else {
        notificationService.error(
          error instanceof ApiError ? error.message : msg('Failed to load client')
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
      case 'origins':
        return html`<oauth2-origins-tab .id=${this.id}></oauth2-origins-tab>`;
      case 'scope-maps':
        return html`<oauth2-scope-maps-tab .id=${this.id}></oauth2-scope-maps-tab>`;
      case 'claim-maps':
        return html`<oauth2-claim-maps-tab .id=${this.id}></oauth2-claim-maps-tab>`;
      case 'image':
        return html`<oauth2-image-tab .id=${this.id}></oauth2-image-tab>`;
      case 'keys':
        return html`<oauth2-keys-tab .id=${this.id}></oauth2-keys-tab>`;
      default:
        return html`<oauth2-settings-tab
          .id=${this.id}
          .detail=${this.detail}
          @oauth2-changed=${() => void this.load()}
        ></oauth2-settings-tab>`;
    }
  }

  /** Built per render so labels re-evaluate msg() after locale switches. */
  private get tabs(): TabDef[] {
    return [
      { id: 'settings', label: msg('Settings') },
      { id: 'origins', label: msg('Origins') },
      { id: 'scope-maps', label: msg('Scope Maps') },
      { id: 'claim-maps', label: msg('Claim Maps') },
      { id: 'image', label: msg('Image') },
      { id: 'keys', label: msg('Keys') },
    ];
  }

  render() {
    return html`
      <admin-layout>
        <a class="back" href="/admin/oauth2">
          <ui-icon name="chevron-right" size="14"></ui-icon>
          ${msg('All OAuth2 clients')}
        </a>
        ${this.loading
          ? html`<p class="muted">${msg('Loading...')}</p>`
          : this.notFound || !this.detail
            ? html`<p class="muted">${msg('Client not found.')}</p>`
            : html`
                <header class="client-head">
                  <div>
                    <h1>${this.detail.displayName}</h1>
                    <p class="muted mono">${this.detail.id}</p>
                    ${this.detail.uuid
                      ? html`<p class="muted mono">${this.detail.uuid}</p>`
                      : nothing}
                  </div>
                </header>
                <tab-bar
                  .tabs=${this.tabs}
                  .active=${this.activeTab}
                  @tab-change=${this.handleTabChange}
                ></tab-bar>
                <section class="tab-content">${this.renderTab()}</section>
              `}
      </admin-layout>
    `;
  }

  static styles = oauth2DetailPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth2-detail-page': Oauth2DetailPage;
  }
}
