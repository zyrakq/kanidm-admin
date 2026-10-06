// Generic data table: column config, loading/empty states, row click,
// optional client-side search (kanidm lists are unpaginated full lists),
// optional row selection with a bulk-delete bar (kanidm has no bulk
// endpoint, so deletion itself is a sequential loop in the caller).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import type { PropertyValues, TemplateResult } from 'lit';
import './ui-icon';
import './list-pager';
import './ui-button';
import './ui-skeleton';

export interface TableColumn {
  /** Key used for search matching and default cell rendering. */
  key: string;
  /** Already-localized column header. */
  header: string;
  /** Custom cell renderer; default renders row[key] as text. */
  render?: (row: Record<string, unknown>) => TemplateResult | string;
}

@customElement('data-table')
@localized()
export class DataTable extends LitElement {
  @property({ type: Array }) columns: TableColumn[] = [];
  @property({ type: Array }) rows: Record<string, unknown>[] = [];
  @property({ type: Boolean }) loading = false;
  /** Already-localized empty-state message. */
  @property() emptyMessage = '';
  /** Show the client-side search input. */
  @property({ type: Boolean }) searchable = false;
  /** Already-localized search placeholder. */
  @property() searchPlaceholder = '';
  /** Show the row-selection column and the bulk-delete bar. */
  @property({ type: Boolean }) selectable = false;

  @state() private searchTerm = '';
  @state() private page = 1;
  @state() private pageSize = 10;
  /** Ids (row.id) of selected rows; survives search and paging. */
  @state() private selected = new Set<string>();

  private handleSearch(e: Event): void {
    this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
    this.page = 1;
  }

  private rowId(row: Record<string, unknown>): string {
    return String(row['id'] ?? '');
  }

  /** Filtered rows plus the current page slice of them. */
  private paginate(): {
    filtered: Record<string, unknown>[];
    pageRows: Record<string, unknown>[];
    safePage: number;
  } {
    const filtered = this.visibleRows();
    const pageCount = Math.max(1, Math.ceil(filtered.length / this.pageSize));
    const safePage = Math.min(this.page, pageCount);
    const pageRows = filtered.slice(
      (safePage - 1) * this.pageSize,
      safePage * this.pageSize
    );
    return { filtered, pageRows, safePage };
  }

  private toggleRowSelection(
    row: Record<string, unknown>,
    checked: boolean
  ): void {
    const next = new Set(this.selected);
    const id = this.rowId(row);
    if (checked) {
      next.add(id);
    } else {
      next.delete(id);
    }
    this.selected = next;
  }

  /** Select/deselect every filtered row (across all pages). */
  private toggleAllSelection(checked: boolean): void {
    const next = new Set(this.selected);
    for (const row of this.visibleRows()) {
      const id = this.rowId(row);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
    }
    this.selected = next;
  }

  /** Rows currently selected, in this.rows order. */
  private selectedRows(): Record<string, unknown>[] {
    return this.rows.filter((row) => this.selected.has(this.rowId(row)));
  }

  private handleBulkDelete(): void {
    this.dispatchEvent(
      new CustomEvent('bulk-delete', {
        detail: { rows: this.selectedRows() },
        bubbles: true,
        composed: true,
      })
    );
  }

  private visibleRows(): Record<string, unknown>[] {
    if (!this.searchTerm) {
      return this.rows;
    }
    return this.rows.filter((row) =>
      this.columns.some((column) =>
        String(row[column.key] ?? '').toLowerCase().includes(this.searchTerm)
      )
    );
  }

  private handleRowClick(row: Record<string, unknown>): void {
    this.dispatchEvent(
      new CustomEvent('row-click', { detail: { row }, bubbles: true, composed: true })
    );
  }

  private renderCell(
    row: Record<string, unknown>,
    column: TableColumn
  ): TemplateResult | string {
    return column.render ? column.render(row) : String(row[column.key] ?? '');
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // Prune the selection to rows that still exist — after a reload
    // following deletions the deleted ids vanish, while failed ones
    // stay selected for a retry.
    if (changed.has('rows')) {
      const ids = new Set(this.rows.map((row) => this.rowId(row)));
      const pruned = new Set([...this.selected].filter((id) => ids.has(id)));
      if (pruned.size !== this.selected.size) {
        this.selected = pruned;
      }
    }
    // Lit can't bind the indeterminate state declaratively.
    const selectAll = this.renderRoot.querySelector<HTMLInputElement>(
      '.select-all'
    );
    if (selectAll) {
      const filtered = this.visibleRows();
      const selectedCount = filtered.filter((row) =>
        this.selected.has(this.rowId(row))
      ).length;
      selectAll.checked =
        filtered.length > 0 && selectedCount === filtered.length;
      selectAll.indeterminate = selectedCount > 0 && !selectAll.checked;
    }
  }

  render() {
    const { filtered, pageRows, safePage } = this.paginate();
    const colCount = this.columns.length + (this.selectable ? 1 : 0);
    const allFilteredSelected =
      filtered.length > 0 &&
      filtered.every((row) => this.selected.has(this.rowId(row)));
    return html`
      ${this.searchable
        ? html`
            <div class="search">
              <ui-icon name="search" size="16"></ui-icon>
              <input
                type="text"
                .value=${this.searchTerm}
                placeholder=${this.searchPlaceholder || msg('Search...')}
                @input=${this.handleSearch}
                aria-label=${this.searchPlaceholder || msg('Search...')}
              />
            </div>
          `
        : nothing}
      ${this.selectable
        ? html`
            <div class="selection-bar" role="toolbar">
              <span class="selection-count">
                ${msg(str`${this.selected.size} selected`)}
              </span>
              <ui-button
                variant="danger-ghost"
                size="sm"
                icon="trash"
                ?disabled=${this.selected.size === 0}
                @click=${() => this.handleBulkDelete()}
              >
                ${msg('Delete selected')}
              </ui-button>
            </div>
          `
        : nothing}
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${this.selectable
                ? html`<th class="col-select">
                    <input
                      type="checkbox"
                      class="select-all"
                      .checked=${allFilteredSelected}
                      ?disabled=${this.loading || filtered.length === 0}
                      aria-label=${msg('Select all')}
                      @change=${(e: Event) =>
                        this.toggleAllSelection(
                          (e.target as HTMLInputElement).checked
                        )}
                    />
                  </th>`
                : nothing}
              ${this.columns.map(
                (column) => html`<th scope="col">${column.header}</th>`
              )}
            </tr>
          </thead>
          <tbody>
            ${this.loading
              ? [0, 1, 2].map(
                  () => html`<tr class="skeleton-row">
                    <td colspan=${colCount}>
                      <ui-skeleton height="16px"></ui-skeleton>
                    </td>
                  </tr>`
                )
              : filtered.length === 0
                ? html`<tr class="state-row">
                    <td colspan=${colCount}>
                      ${this.emptyMessage || msg('No entries found.')}
                    </td>
                  </tr>`
                : pageRows.map(
                    (row) => html`
                      <tr class="data-row" @click=${() => this.handleRowClick(row)}>
                        ${this.selectable
                          ? html`<td
                              class="col-select"
                              @click=${(e: Event) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                .checked=${this.selected.has(this.rowId(row))}
                                aria-label=${msg(str`Select ${this.rowId(row)}`)}
                                @change=${(e: Event) =>
                                  this.toggleRowSelection(
                                    row,
                                    (e.target as HTMLInputElement).checked
                                  )}
                              />
                            </td>`
                          : nothing}
                        ${this.columns.map(
                          (column) => html`<td>${this.renderCell(row, column)}</td>`
                        )}
                      </tr>
                    `
                  )}
          </tbody>
        </table>
      </div>
      <list-pager
        .total=${filtered.length}
        .page=${safePage}
        .pageSize=${this.pageSize}
        @page-change=${(e: CustomEvent<{ page: number }>) =>
          (this.page = e.detail.page)}
        @page-size-change=${(e: CustomEvent<{ pageSize: number }>) => {
          this.pageSize = e.detail.pageSize;
          this.page = 1;
        }}
      ></list-pager>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .search {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-md);
      background: var(--theme-color-surface-sunken);
      box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.06);
      margin-bottom: 12px;
      color: var(--theme-color-text-muted);
      transition:
        border-color var(--theme-duration-fast) var(--theme-ease),
        box-shadow var(--theme-duration-fast) var(--theme-ease);
    }
    .search:hover {
      border-color: var(--theme-color-border-strong);
    }
    .search:focus-within {
      border-color: var(--theme-color-primary);
      box-shadow: var(--theme-focus-ring);
      color: var(--theme-color-text-secondary);
    }
    .search input {
      box-sizing: border-box;
      border: none;
      outline: none;
      background: transparent;
      color: var(--theme-color-text-primary);
      width: 100%;
      font: inherit;
    }
    .table-wrap {
      overflow-x: auto;
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-lg);
      background: var(--theme-color-surface);
      box-shadow: var(--theme-elevation-1), var(--theme-highlight);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      text-align: left;
      padding: 10px 14px;
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--theme-color-text-muted);
      background: var(--theme-color-surface-sunken);
      border-bottom: 1px solid var(--theme-color-border);
      white-space: nowrap;
    }
    td {
      padding: 12px 14px;
      color: var(--theme-color-text-primary);
      border-bottom: 1px solid var(--theme-color-border);
    }
    tr:last-child td {
      border-bottom: none;
    }
    .data-row {
      cursor: pointer;
      transition: background-color var(--theme-duration-fast) var(--theme-ease);
    }
    .data-row:hover {
      background: var(--theme-color-surface-hover);
    }
    .state-row td {
      text-align: center;
      color: var(--theme-color-text-muted);
      padding: 28px 14px;
      cursor: default;
    }
    .skeleton-row td {
      padding: 14px;
    }
    .col-select {
      width: 36px;
      text-align: center;
    }
    .col-select input {
      cursor: pointer;
      accent-color: var(--theme-color-primary);
    }
    /* Column renderers run inside THIS shadow root, so any class used by
       list-page render functions must be styled here — the page's own
       adoptedStyleSheets cannot cross the shadow boundary. */
    .btn-delete {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: var(--theme-radius-sm);
      background: none;
      color: var(--theme-color-error);
      cursor: pointer;
      vertical-align: middle;
      transition:
        color var(--theme-duration-fast) var(--theme-ease),
        background-color var(--theme-duration-fast) var(--theme-ease);
    }
    .btn-delete:hover {
      background: var(--theme-color-error-soft);
    }
    .btn-delete:focus-visible {
      outline: none;
      box-shadow: var(--theme-focus-ring);
    }
    .mono {
      font-family: var(--theme-font-mono, monospace);
      font-size: 13px;
    }
    .selection-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border: 1px solid var(--theme-color-border);
      border-radius: var(--theme-radius-md);
      background: var(--theme-color-surface);
      box-shadow: var(--theme-elevation-1), var(--theme-highlight);
      margin-bottom: 12px;
    }
    .selection-count {
      font-size: 14px;
      font-weight: 500;
      color: var(--theme-color-text-primary);
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'data-table': DataTable;
  }
}
