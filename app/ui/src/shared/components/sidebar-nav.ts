// Section sidebar: sections filtered by the user's groups (access map),
// icons, active state from the current location. Re-renders on
// 'auth-state-changed' (D7) and 'route-changed' (SPA navigation).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { visibleSections, type SectionDef } from '@/shared/access/section-access';
import type { IconName } from './ui-icon';
import './ui-icon';

@customElement('sidebar-nav')
@localized()
export class SidebarNav extends LitElement {
  @state() private sections: SectionDef[] = [];
  @state() private activePath = window.location.pathname;

  connectedCallback(): void {
    super.connectedCallback();
    this.refresh();
    window.addEventListener('auth-state-changed', this.handleAuthChange);
    window.addEventListener('route-changed', this.handleNavigation);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('auth-state-changed', this.handleAuthChange);
    window.removeEventListener('route-changed', this.handleNavigation);
  }

  private handleAuthChange = (): void => {
    this.refresh();
  };

  private handleNavigation = (): void => {
    this.activePath = window.location.pathname;
  };

  private refresh(): void {
    this.sections = visibleSections(authService.getGroups());
    this.activePath = window.location.pathname;
  }

  private navigate(): void {
    this.dispatchEvent(
      new CustomEvent('nav-click', { bubbles: true, composed: true })
    );
    // Let the Router's global anchor-click interceptor handle it: no
    // preventDefault and no window.location.assign (that would do a full
    // page reload). Clicking the same section is a no-op (href unchanged).
  }

  render() {
    if (this.sections.length === 0) {
      return nothing;
    }
    return html`
      <nav aria-label=${msg('Admin sections')}>
        ${this.sections.map(
          (section) => html`
            <a
              class="item ${this.activePath.startsWith(section.href) ? 'active' : ''}"
              href=${section.href}
              @click=${() => {
                this.navigate();
              }}
            >
              <ui-icon name=${section.icon as IconName} size="18"></ui-icon>
              <span>${section.label()}</span>
            </a>
          `
        )}
      </nav>
    `;
  }

  static styles = css`
    nav {
      display: flex;
      flex-direction: column;
      gap: 2px;
      padding: 12px 8px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 9px 12px;
      border-radius: 6px;
      color: var(--theme-color-text-secondary);
      text-decoration: none;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease, color 0.2s ease;
    }
    .item:hover {
      background: var(--theme-color-background);
      color: var(--theme-color-text-primary);
    }
    .item.active {
      background: var(--theme-color-background);
      color: var(--theme-color-primary);
    }
    @media (max-width: 768px) {
      nav {
        gap: 8px;
        padding: 1rem;
      }
      .item {
        padding: 1rem 1.25rem;
        font-size: 1.125rem;
        gap: 1rem;
        border-radius: 8px;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'sidebar-nav': SidebarNav;
  }
}
