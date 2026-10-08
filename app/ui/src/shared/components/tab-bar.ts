// Tab bar for detail pages. Emits 'tab-change' with the tab id.
// Below 768px the strip collapses into a dropdown menu trigger.

import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import '@/shared/components/ui-icon';
import { tabBarStyles } from './tab-bar.styles';

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

  @state() private menuOpen = false;

  private select(id: string): void {
    if (id !== this.active) {
      this.dispatchEvent(
        new CustomEvent('tab-change', {
          detail: { id },
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  render() {
    const activeTab = this.tabs.find((tab) => tab.id === this.active);
    return html`
      <div class="tab-bar" @keydown=${this.handleKeyDown}>
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
        <button
          class="menu-trigger"
          type="button"
          aria-haspopup="menu"
          aria-expanded=${this.menuOpen ? 'true' : 'false'}
          aria-label=${msg('Section menu')}
          @click=${() => (this.menuOpen = !this.menuOpen)}
        >
          <span class="trigger-label">${activeTab?.label ?? ''}</span>
          <ui-icon name="chevron-down" size="16"></ui-icon>
        </button>
        ${this.menuOpen ? this.renderMenu() : nothing}
      </div>
    `;
  }

  private renderMenu() {
    return html`
      <div class="menu-panel" role="menu">
        ${this.tabs.map(
          (tab) => html`
            <button
              class="menu-item ${tab.id === this.active ? 'active' : ''}"
              role="menuitem"
              type="button"
              @click=${() => this.selectFromMenu(tab.id)}
            >
              ${tab.label}
            </button>
          `
        )}
      </div>
    `;
  }

  private selectFromMenu(id: string): void {
    this.menuOpen = false;
    this.select(id);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.menuOpen) {
      this.menuOpen = false;
    }
  }

  private handleDocumentClick = (e: Event): void => {
    if (!e.composedPath().includes(this)) {
      this.menuOpen = false;
    }
  };

  protected updated(changed: PropertyValues): void {
    if (changed.has('menuOpen')) {
      if (this.menuOpen) {
        document.addEventListener('click', this.handleDocumentClick);
      } else {
        document.removeEventListener('click', this.handleDocumentClick);
      }
    }
    if (changed.has('active')) {
      this.renderRoot
        .querySelector<HTMLButtonElement>('.tab.active')
        ?.scrollIntoView({
          inline: 'nearest',
          block: 'nearest',
          behavior: 'smooth',
        });
    }
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    document.removeEventListener('click', this.handleDocumentClick);
  }

  static styles = tabBarStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'tab-bar': TabBar;
  }
}
