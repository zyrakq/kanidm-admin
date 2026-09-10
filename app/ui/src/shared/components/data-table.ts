// Generic data table: column config, loading/empty states, row click,
// optional client-side search (kanidm lists are unpaginated full lists).

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import type { TemplateResult } from 'lit';
import './ui-icon';

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

  @state() private searchTerm = '';

  private handleSearch(e: Event): void {
    this.searchTerm = (e.target as HTMLInputElement).value.toLowerCase();
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

  render() {
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
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              ${this.columns.map(
                (column) => html`<th scope="col">${column.header}</th>`
              )}
            </tr>
          </thead>
          <tbody>
            ${this.loading
              ? html`<tr class="state-row">
                  <td colspan=${this.columns.length}>${msg('Loading...')}</td>
                </tr>`
              : this.visibleRows().length === 0
                ? html`<tr class="state-row">
                    <td colspan=${this.columns.length}>
                      ${this.emptyMessage || msg('No entries found.')}
                    </td>
                  </tr>`
                : this.visibleRows().map(
                    (row) => html`
                      <tr class="data-row" @click=${() => this.handleRowClick(row)}>
                        ${this.columns.map(
                          (column) => html`<td>${this.renderCell(row, column)}</td>`
                        )}
                      </tr>
                    `
                  )}
          </tbody>
        </table>
      </div>
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
      border-radius: 6px;
      margin-bottom: 12px;
      color: var(--theme-color-text-muted);
    }
    .search input {
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
      border-radius: 8px;
      background: var(--theme-color-surface);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th {
      text-align: left;
      padding: 10px 14px;
      font-weight: 600;
      color: var(--theme-color-text-secondary);
      border-bottom: 1px solid var(--theme-color-border);
      white-space: nowrap;
    }
    td {
      padding: 10px 14px;
      color: var(--theme-color-text-primary);
      border-bottom: 1px solid var(--theme-color-border);
    }
    tr:last-child td {
      border-bottom: none;
    }
    .data-row {
      cursor: pointer;
      transition: background-color 0.15s ease;
    }
    .data-row:hover {
      background: var(--theme-color-background);
    }
    .state-row td {
      text-align: center;
      color: var(--theme-color-text-muted);
      padding: 24px 14px;
      cursor: default;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'data-table': DataTable;
  }
}
