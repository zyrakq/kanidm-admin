// Tab bar for detail pages. Emits 'tab-change' with the tab id.

import { LitElement, css, html, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { localized } from '@/features/localization';

export interface TabDef {
  id: string;
  /** Already-localized tab label. */
  label: string;
}

@customElement('tab-bar')
@localized()
export class TabBar extends LitElement {
  @property({ type: Array }) tabs: TabDef[] = [];
  @property() active = '';

  private select(id: string): void {
    if (id !== this.active) {
      this.dispatchEvent(
        new CustomEvent('tab-change', { detail: { id }, bubbles: true, composed: true })
      );
    }
  }

  render() {
    return html`
      <div class="tabs" role="tablist">
        ${this.tabs.map(
          (tab) => html`
            <button
              class="tab ${tab.id === this.active ? 'active' : ''}"
              role="tab"
              aria-selected=${tab.id === this.active ? 'true' : 'false'}
              type="button"
              @click=${() => this.select(tab.id)}
            >
              ${tab.label}
            </button>
          `
        )}
      </div>
    `;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('active')) {
      this.renderRoot
        .querySelector<HTMLButtonElement>('.tab.active')
        ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  }

  static styles = css`
    .tabs {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid var(--theme-color-border);
      overflow-x: auto;
    }
    .tab {
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      padding: 10px 16px;
      font: inherit;
      font-weight: 500;
      color: var(--theme-color-text-secondary);
      cursor: pointer;
      white-space: nowrap;
      transition: color 0.2s ease, border-color 0.2s ease;
    }
    .tab:hover {
      color: var(--theme-color-text-primary);
    }
    .tab.active {
      color: var(--theme-color-primary);
      border-bottom-color: var(--theme-color-primary);
    }
    @media (max-width: 768px) {
      .tab {
        flex: 1 1 auto;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    }
    @media (max-width: 640px) {
      .tab {
        padding: 8px 12px;
        font-size: 0.875rem;
      }
    }
    @media (max-width: 480px) {
      .tab {
        padding: 6px 10px;
        font-size: 0.8125rem;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'tab-bar': TabBar;
  }
}
