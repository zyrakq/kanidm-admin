import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Router } from '@lit-labs/router';
import { authService } from '@/features/auth';
import { localizationService } from '@/features/localization';
import {
  canAccess,
  firstVisiblePath,
  type SectionId,
} from '@/shared/access/section-access';
import { navigate, registerRouter } from '@/shared/services/router.service';
import { kanidmStatusService } from '@/shared/services/kanidm-status.service';
import '@/features/theme/services/favicon.service';
import '@/features/customization';

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
import '@/features/domain/components/domain-page';
import '@/features/system/components/system-page';
import '@/features/applications/components/application-list-page';
import '@/features/sync/components/sync-list-page';
import '@/features/sync/components/sync-detail-page';
import '@/features/recycle-bin/components/recycle-bin-page';
import '@/features/messages/components/messages-page';
import '@/features/customization/components/customization-page';

@customElement('app-component')
export class AppComponent extends LitElement {
  constructor() {
    super();
    localizationService.init();
    registerRouter(this._router);
  }

  private _router = new Router(this, [
    {
      path: '/',
      render: () => html`<welcome-page></welcome-page>`,
      enter: async () => {
        await authService.init();
        if (authService.isAuthenticated()) {
          const target = firstVisiblePath(authService.getGroups());
          navigate(target ?? '/admin/no-access', { replace: true });
          return false;
        }
        return true;
      },
    },
    {
      path: '/dashboard',
      // Legacy bookmark: the dashboard was removed; land on /admin.
      enter: async () => {
        navigate('/admin', { replace: true });
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
      render: () =>
        html`<service-account-list-page></service-account-list-page>`,
      enter: async () => this.guardSection('service-accounts'),
    },
    {
      path: '/admin/service-accounts/:id',
      render: ({ id }) =>
        html`<service-account-detail-page
          .id=${id ?? ''}
        ></service-account-detail-page>`,
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
      path: '/admin/domain',
      render: () => html`<domain-page></domain-page>`,
      enter: async () => this.guardSection('domain'),
    },
    {
      path: '/admin/system',
      render: () => html`<system-page></system-page>`,
      enter: async () => this.guardSection('system'),
    },
    {
      path: '/admin/applications',
      render: () => html`<application-list-page></application-list-page>`,
      enter: async () => this.guardSection('applications'),
    },
    {
      path: '/admin/sync',
      render: () => html`<sync-list-page></sync-list-page>`,
      enter: async () => this.guardSection('sync'),
    },
    {
      path: '/admin/sync/:id',
      render: ({ id }) =>
        html`<sync-detail-page .id=${id ?? ''}></sync-detail-page>`,
      enter: async () => this.guardSection('sync'),
    },
    {
      path: '/admin/recycle-bin',
      render: () => html`<recycle-bin-page></recycle-bin-page>`,
      enter: async () => this.guardSection('recycle-bin'),
    },
    {
      path: '/admin/messages',
      render: () => html`<messages-page></messages-page>`,
      enter: async () => this.guardSection('messages'),
    },
    {
      path: '/design',
      render: () => html`<customization-page></customization-page>`,
      enter: async () => {
        // Public standalone page (no auth guard). When the backend
        // flag is off the management API is unmounted too, so the
        // page would be a dead end — redirect home instead.
        const status = await kanidmStatusService.fetchStatus();
        if (!status.customizationPage) {
          navigate('/', { replace: true });
          return false;
        }
        return true;
      },
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
      navigate('/', { replace: true });
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
      navigate('/admin/no-access', { replace: true });
      return false;
    }
    return true;
  }

  render() {
    // App	controller is re-rendered on every navigation, so this is a good point to announce the current path to route-aware components (e.g. sidebar active state).
    window.dispatchEvent(new CustomEvent('route-changed'));
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
