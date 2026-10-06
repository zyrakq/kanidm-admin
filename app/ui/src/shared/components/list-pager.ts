// Reusable pager with prev/next controls, range label and page-size select
// for client-side pagination.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import './form-field';
import './ui-button';

const PAGE_SIZE_OPTIONS: { value: string; label: string }[] = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
];

@customElement('list-pager')
@localized()
export class ListPager extends LitElement {
  @property({ type: Number }) total = 0;
  @property({ type: Number }) page = 1;
  @property({ type: Number }) pageSize = 10;

  private get pageCount(): number {
    return Math.max(1, Math.ceil(this.total / this.pageSize));
  }

  render() {
    if (this.total <= this.pageSize) return nothing;

    const from = this.total === 0 ? 0 : (this.page - 1) * this.pageSize + 1;
    const to = Math.min(this.page * this.pageSize, this.total);

    return html`
      <div class="pager">
        <span class="range">${msg(str`${from}–${to} of ${this.total}`)}</span>
        <div class="controls">
          <ui-button
            variant="secondary"
            size="sm"
            ?disabled=${this.page <= 1}
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('page-change', {
                  detail: { page: this.page - 1 },
                  bubbles: true,
                  composed: true,
                })
              )}
          >
            ${msg('Previous')}
          </ui-button>
          <ui-button
            variant="secondary"
            size="sm"
            ?disabled=${this.page >= this.pageCount}
            @click=${() =>
              this.dispatchEvent(
                new CustomEvent('page-change', {
                  detail: { page: this.page + 1 },
                  bubbles: true,
                  composed: true,
                })
              )}
          >
            ${msg('Next')}
          </ui-button>
        </div>
        <form-field
          class="size-field"
          style="--field-margin: 0"
          field-id="pager-page-size"
          label=${msg('Rows per page')}
          type="select"
          .value=${String(this.pageSize)}
          .options=${PAGE_SIZE_OPTIONS}
          @field-input=${(e: CustomEvent<{ value: string }>) =>
            this.dispatchEvent(
              new CustomEvent('page-size-change', {
                detail: { pageSize: Number(e.detail.value) },
                bubbles: true,
                composed: true,
              })
            )}
        ></form-field>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .pager {
      display: flex;
      align-items: flex-end;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 12px;
    }
    .range {
      font-size: 13px;
      color: var(--theme-color-text-secondary);
      padding-bottom: 9px;
    }
    .controls {
      display: flex;
      gap: 8px;
      padding-bottom: 9px;
    }
    .size-field {
      margin-left: auto;
      min-width: 110px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'list-pager': ListPager;
  }
}
