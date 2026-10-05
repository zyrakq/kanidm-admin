// Admin page chrome: app-header on top, sidebar on the left, slotted
// page content, footer at the bottom. Every admin route renders inside
// one of these.

import { LitElement, css, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { localized } from '@/features/localization';
import '@/shared/components/app-header';
import '@/shared/components/sidebar-nav';
import '@/shared/components/footer-info';
import '@/shared/components/version-banner';

@customElement('admin-layout')
@localized()
export class AdminLayout extends LitElement {
  @state() private drawerOpen = false;
  @state() private drawerAnimated = false;
  private mq = window.matchMedia('(max-width: 768px)');

  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('keydown', this.handleKeyDown);
    this.mq.addEventListener('change', this.handleBreakpointChange);
    window.addEventListener('session-drawer-open', this.handleSessionDrawerOpen);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('keydown', this.handleKeyDown);
    this.mq.removeEventListener('change', this.handleBreakpointChange);
    window.removeEventListener('session-drawer-open', this.handleSessionDrawerOpen);
    document.body.style.overflow = '';
  }

  private handleBreakpointChange = (e: MediaQueryListEvent): void => {
    if (!e.matches) {
      this.closeDrawer();
      this.drawerAnimated = false; // first desktop->mobile re-open has no transition
    }
  };

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.drawerOpen) this.closeDrawer();
  };

  private closeDrawer = (): void => {
    this.drawerOpen = false;
    document.body.style.overflow = '';
  };

  private handleDrawerToggle = (): void => {
    this.drawerAnimated = true;
    this.drawerOpen = !this.drawerOpen;
    // Mutual-close FIRST, scroll lock after: the session drawer's
    // closer clears body.overflow, this opener re-locks it below.
    if (this.drawerOpen) {
      window.dispatchEvent(new CustomEvent('admin-drawer-open'));
    }
    document.body.style.overflow = this.drawerOpen ? 'hidden' : '';
  };

  /** The session drawer opened: close our burger drawer if it is open. */
  private handleSessionDrawerOpen = (): void => {
    if (this.drawerOpen) this.closeDrawer();
  };

  private handleNavClick = (): void => {
    if (this.drawerOpen) this.closeDrawer();
  };

  render() {
    const layoutClass = `layout${this.drawerOpen ? ' drawer-open' : ''}${
      this.drawerAnimated ? ' drawer-animated' : ''
    }`;
    return html`
      <div class=${layoutClass}>
        <app-header
          .burger=${true}
          .drawerOpen=${this.drawerOpen}
          @admin-drawer-toggle=${this.handleDrawerToggle}
        ></app-header>
        <div class="body">
          <aside class="sidebar">
            <sidebar-nav @nav-click=${this.handleNavClick}></sidebar-nav>
          </aside>
          <main class="content">
            <version-banner></version-banner>
            <slot></slot>
          </main>
        </div>
        <footer-info></footer-info>
        <div class="backdrop" @click=${this.closeDrawer}></div>
      </div>
    `;
  }

  static styles = css`
    :host {
      --header-height: 64px;
    }
    .layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .body {
      display: flex;
      flex: 1;
      min-height: 0;
    }
    .sidebar {
      width: 230px;
      flex-shrink: 0;
      border-right: 1px solid var(--theme-color-border);
      background: var(--theme-color-surface);
    }
    .content {
      flex: 1;
      padding: 24px;
      min-width: 0;
      background: var(--theme-color-background);
    }
    .backdrop {
      display: none;
    }
    @media (max-width: 768px) {
      .sidebar {
        position: fixed;
        top: var(--header-height);
        left: 0;
        right: 0;
        bottom: 0;
        width: auto;
        transform: translateX(-100%);
        visibility: hidden;
        z-index: 1500;
        background: var(--theme-color-surface);
        box-shadow: var(--theme-shadow-lg);
        overflow-y: auto;
      }
      .layout.drawer-open .sidebar {
        transform: translateX(0);
        visibility: visible;
      }
      .layout.drawer-animated .sidebar {
        transition: transform 0.3s ease, visibility 0s linear 0.3s;
      }
      .layout.drawer-animated.drawer-open .sidebar {
        transition: transform 0.3s ease;
      }
      .backdrop {
        display: block;
        position: fixed;
        top: var(--header-height);
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 1400;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      }
      .layout.drawer-open .backdrop {
        opacity: 1;
        pointer-events: auto;
      }
      .content {
        padding: 16px;
      }
    }
    @media (max-width: 480px) {
      .content {
        padding: 12px;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-layout': AdminLayout;
  }
}
