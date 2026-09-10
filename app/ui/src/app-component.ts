import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@lit-labs/router';
import { authService } from '@/features/auth';
import { localizationService } from '@/features/localization';
import { canAccess, firstVisiblePath, type SectionId } from '@/shared/access/section-access';
import '@/features/theme/services/favicon.service';

// Route targets. Section features register their pages here as they are
// implemented (batches 3-8); until then the routes below cover the
// foundation pages only.
import '@/pages/welcome-page';
import '@/pages/admin-overview-page';
import '@/pages/no-access-page';
import '@/features/auth/components/reauth-modal';
import '@/features/notifications/components/toast-container';
import '@/features/persons/components/person-list-page';
import '@/features/persons/components/person-detail-page';
import '@/features/groups/components/group-list-page';
import '@/features/groups/components/group-detail-page';
import '@/features/service-accounts/components/service-account-list-page';
import '@/features/service-accounts/components/service-account-detail-page';
import '@/features/oauth2/components/oauth2-list-page';
import '@/features/oauth2/components/oauth2-detail-page';

@customElement('app-component')
export class AppComponent extends LitElement {
  constructor() {
    super();
    localizationService.init();
  }

  private _router = new Router(this, [
    {
      path: '/',
      render: () => html`<welcome-page></welcome-page>`,
      enter: async () => {
        await authService.init();
        if (authService.isAuthenticated()) {
          const target = firstVisiblePath(authService.getGroups());
          this._router.goto(target ?? '/admin/no-access');
          return false;
        }
        return true;
      },
    },
    {
      path: '/dashboard',
      // Legacy bookmark: the dashboard was removed; land on /admin.
      enter: async () => {
        this._router.goto('/admin');
        return false;
      },
      render: () => html``,
    },
    {
      path: '/admin',
      render: () => html`<admin-overview-page></admin-overview-page>`,
      enter: async () => this.guardAdmin(),
    },
    {
      path: '/admin/persons',
      render: () => html`<person-list-page></person-list-page>`,
      enter: async () => this.guardSection('persons'),
    },
    {
      path: '/admin/persons/:id',
      render: ({ id }) =>
        html`<person-detail-page .id=${id ?? ''}></person-detail-page>`,
      enter: async () => this.guardSection('persons'),
    },
    {
      path: '/admin/groups',
      render: () => html`<group-list-page></group-list-page>`,
      enter: async () => this.guardSection('groups'),
    },
    {
      path: '/admin/groups/:id',
      render: ({ id }) =>
        html`<group-detail-page .id=${id ?? ''}></group-detail-page>`,
      enter: async () => this.guardSection('groups'),
    },
    {
      path: '/admin/service-accounts',
      render: () => html`<service-account-list-page></service-account-list-page>`,
      enter: async () => this.guardSection('service-accounts'),
    },
    {
      path: '/admin/service-accounts/:id',
      render: ({ id }) =>
        html`<service-account-detail-page .id=${id ?? ''}></service-account-detail-page>`,
      enter: async () => this.guardSection('service-accounts'),
    },
    {
      path: '/admin/oauth2',
      render: () => html`<oauth2-list-page></oauth2-list-page>`,
      enter: async () => this.guardSection('oauth2'),
    },
    {
      path: '/admin/oauth2/:id',
      render: ({ id }) =>
        html`<oauth2-detail-page .id=${id ?? ''}></oauth2-detail-page>`,
      enter: async () => this.guardSection('oauth2'),
    },
    {
      path: '/admin/no-access',
      render: () => html`<no-access-page></no-access-page>`,
      enter: async () => this.guardAdmin(),
    },
    // Section routes are appended here by batches 3-8, each following:
    //   {
    //     path: '/admin/<section>',
    //     render: () => html`<x-list-page></x-list-page>`,
    //     enter: async () => this.guardSection('<section-id>'),
    //   },
    //   {
    //     path: '/admin/<section>/:id',
    //     render: ({ id }) => html`<x-detail-page .id=${id}></x-detail-page>`,
    //     enter: async () => this.guardSection('<section-id>'),
    //   },
  ]);

  /** Authenticated users only; unauthenticated go to the welcome page. */
  private async guardAdmin(): Promise<boolean> {
    await authService.init();
    if (!authService.isAuthenticated()) {
      this._router.goto('/');
      return false;
    }
    return true;
  }

  /** Authenticated AND authorized for the section; otherwise no-access. */
  private async guardSection(section: SectionId): Promise<boolean> {
    if (!(await this.guardAdmin())) {
      return false;
    }
    if (!canAccess(authService.getGroups(), section)) {
      this._router.goto('/admin/no-access');
      return false;
    }
    return true;
  }

  render() {
    return html`${this._router.outlet()}`;
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'app-component': AppComponent;
  }
}
