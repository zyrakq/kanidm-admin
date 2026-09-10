// Landing page after login: session card, server status card, quick
// stats (counts via permitted list endpoints), quick links to sections.

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { apiFetch } from '@/shared/services/http-client';
import { visibleSections } from '@/shared/access/section-access';
import { kanidmStatusService } from '@/shared/services/kanidm-status.service';
import type { KanidmEntry } from '@/shared/types/kanidm';
import '@/shared/components/admin-layout';
import '@/shared/components/ui-icon';
import { adminOverviewPageStyles } from './admin-overview-page.styles';

@customElement('admin-overview-page')
@localized()
export class AdminOverviewPage extends LitElement {
  @state() private personCount: number | null = null;
  @state() private groupCount: number | null = null;
  @state() private status: 'alive' | 'unreachable' | 'unknown' = 'unknown';

  connectedCallback(): void {
    super.connectedCallback();
    void this.loadStatus();
    void this.loadCounts();
  }

  private async loadStatus(): Promise<void> {
    // kanidmStatusService.fetchStatus() never throws; it normalizes any
    // failure into an 'unreachable' state.
    const result = await kanidmStatusService.fetchStatus();
    this.status = result.state === 'alive' ? 'alive' : 'unreachable';
  }

  // Quick stats: only endpoints the user may actually list (access map);
  // failures leave the card at "—" instead of erroring the page.
  private async loadCounts(): Promise<void> {
    const groups = authService.getGroups();
    const jobs: Promise<void>[] = [];
    if (groups.includes('idm_people_admins')) {
      jobs.push(this.count('/api/kanidm/v1/person', (n) => (this.personCount = n)));
    }
    if (groups.includes('idm_group_admins')) {
      jobs.push(this.count('/api/kanidm/v1/group', (n) => (this.groupCount = n)));
    }
    await Promise.allSettled(jobs);
  }

  private async count(path: string, set: (n: number) => void): Promise<void> {
    const entries = await apiFetch<KanidmEntry[]>(path);
    set(entries.length);
  }

  render() {
    const user = authService.getUser();
    const state = authService.getAuthState();
    const sections = visibleSections(authService.getGroups());

    return html`
      <admin-layout>
        <h1 class="page-title">${msg('Administration')}</h1>

        <div class="cards">
          <section class="card">
            <h2>${msg('Session')}</h2>
            <p class="big">${user?.displayName || user?.username || ''}</p>
            <p class="muted">${user?.username || ''}</p>
            <p class="muted">
              ${state.writeUntil
                ? msg('Elevated access active')
                : msg('Elevated access requires re-authentication')}
            </p>
          </section>

          <section class="card">
            <h2>${msg('Server')}</h2>
            <p class="big">
              ${this.status === 'alive'
                ? msg('Kanidm is reachable')
                : this.status === 'unreachable'
                  ? msg('Kanidm is unreachable')
                  : msg('Checking server...')}
            </p>
          </section>

          <section class="card">
            <h2>${msg('Quick stats')}</h2>
            <p class="muted">${msg('Persons')}: ${this.personCount ?? '—'}</p>
            <p class="muted">${msg('Groups')}: ${this.groupCount ?? '—'}</p>
          </section>
        </div>

        <h2>${msg('Sections')}</h2>
        <div class="links">
          ${sections.map(
            (section) => html`
              <a class="link" href=${section.href}>
                <ui-icon name="chevron-right" size="16"></ui-icon>
                <span>${section.label()}</span>
              </a>
            `
          )}
          ${sections.length === 0
            ? html`<p class="muted">
                ${msg('No admin sections available for your account.')}
              </p>`
            : nothing}
        </div>
      </admin-layout>
    `;
  }

  static styles = adminOverviewPageStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-overview-page': AdminOverviewPage;
  }
}
