// Admin page chrome: app-header on top, sidebar on the left, slotted
// page content, footer at the bottom. Every admin route renders inside
// one of these.

import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { localized } from '@/features/localization';
import '@/shared/components/app-header';
import '@/shared/components/sidebar-nav';
import '@/shared/components/footer-info';

@customElement('admin-layout')
@localized()
export class AdminLayout extends LitElement {
  render() {
    return html`
      <div class="layout">
        <app-header></app-header>
        <div class="body">
          <aside class="sidebar">
            <sidebar-nav></sidebar-nav>
          </aside>
          <main class="content">
            <slot></slot>
          </main>
        </div>
        <footer-info></footer-info>
      </div>
    `;
  }

  static styles = css`
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
    @media (max-width: 900px) {
      .body {
        flex-direction: column;
      }
      .sidebar {
        width: 100%;
        border-right: none;
        border-bottom: 1px solid var(--theme-color-border);
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'admin-layout': AdminLayout;
  }
}
