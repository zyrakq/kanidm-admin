// Standalone page chrome for public, non-admin routes: app-header on
// top, slotted page content, footer at the bottom. No sidebar — these
// pages live outside the admin section model.

import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import '@/shared/components/app-header';
import '@/shared/components/footer-info';

@customElement('standalone-layout')
export class StandaloneLayout extends LitElement {
  render() {
    return html`
      <div class="layout">
        <app-header></app-header>
        <main class="content">
          <slot></slot>
        </main>
        <footer-info></footer-info>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
    }
    .layout {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
    }
    .content {
      flex: 1;
      padding: 24px;
      min-width: 0;
      background: var(--theme-color-background);
    }
    @media (max-width: 768px) {
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
    'standalone-layout': StandaloneLayout;
  }
}
