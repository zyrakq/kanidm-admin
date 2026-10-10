// Customization admin page, split into two subsections: theme variants
// (light/dark dropdowns over the discovered CSS files, plus upload and
// per-variant delete) and branding (light/dark logo and favicon).
// Selecting "Built-in default" clears the stored selection so the
// deployment default (config/env) applies again.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, query, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import logoLight from '@/assets/logo-light.svg';
import logoDark from '@/assets/logo-dark.svg';
import { customizationService } from '../services/customization.service';
import type { ThemeMode } from '../types/customization.types';
import './customization-slot-card';
import '@/shared/components/confirm-dialog';
import '@/shared/components/form-field';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';

@customElement('customization-page')
@localized()
export class CustomizationPage extends LitElement {
  @state() private busy = false;
  @state() private uploading = false;
  /** Variant name pending delete confirmation, or null. */
  @state() private deleteTarget: string | null = null;

  @query('input.variant-input') private variantInput!: HTMLInputElement;

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await customizationService.init();
  }

  private async selectVariant(mode: ThemeMode, value: string): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await customizationService.selectTheme(mode, value === '' ? null : value);
      notificationService.success(msg('Theme selection saved.'));
    } catch {
      notificationService.error(msg('Failed to save the theme selection.'));
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  private async uploadVariant(file: File): Promise<void> {
    if (this.uploading) return;
    this.uploading = true;
    try {
      await customizationService.uploadThemeVariant(file);
      notificationService.success(msg('Variant uploaded.'));
    } catch {
      notificationService.error(msg('Failed to upload the variant.'));
    } finally {
      this.uploading = false;
      this.requestUpdate();
    }
  }

  private async deleteVariant(): Promise<void> {
    const name = this.deleteTarget;
    if (!name || this.busy) return;
    this.busy = true;
    try {
      await customizationService.removeThemeVariant(name);
      this.deleteTarget = null;
      notificationService.success(msg('Variant deleted.'));
    } catch {
      notificationService.error(msg('Failed to delete the variant.'));
    } finally {
      this.busy = false;
      this.requestUpdate();
    }
  }

  private handleVariantFile(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.uploadVariant(file);
  }

  private renderModeSelect(mode: ThemeMode, label: string) {
    const theme = customizationService.theme();
    const info = theme?.[mode];
    const variants = theme?.available ?? [];
    const selected = info?.selected ?? '';
    const isConfigDefault = info?.source === 'config';
    const options = [
      { value: '', label: msg('Built-in default') },
      ...variants.map((v) => ({ value: v, label: v })),
    ];
    return html`
      <form-field
        type="select"
        label=${label}
        fieldId=${'theme-variant-' + mode}
        .options=${options}
        .value=${selected}
        ?disabled=${this.busy}
        hint=${isConfigDefault && selected !== ''
          ? `${msg('Deployment default:')} ${selected}`
          : ''}
        @field-input=${(e: CustomEvent<{ value: string }>) =>
          void this.selectVariant(mode, e.detail.value)}
      ></form-field>
    `;
  }

  private renderThemeSection() {
    const theme = customizationService.theme();
    const variants = theme?.available ?? [];
    return html`
      <h2>${msg('Theme styles')}</h2>
      <ui-card class="theme-card">
        <div class="theme-selects">
          ${this.renderModeSelect('light', msg('Light mode variant'))}
          ${this.renderModeSelect('dark', msg('Dark mode variant'))}
        </div>
        <div class="variant-list">
          ${variants.length === 0
            ? html`<p class="empty">
                ${msg('No theme variants uploaded yet.')}
              </p>`
            : variants.map(
                (v) => html`
                  <div class="variant-row">
                    <span class="variant-name">${v}</span>
                    <ui-button
                      variant="danger"
                      size="sm"
                      ?disabled=${this.busy}
                      @click=${() => {
                        this.deleteTarget = v;
                      }}
                    >
                      ${msg('Delete...')}
                    </ui-button>
                  </div>
                `
              )}
        </div>
        <div class="actions">
          <input
            type="file"
            accept=".css,text/css"
            class="variant-input"
            @change=${this.handleVariantFile}
          />
          <ui-button
            variant="primary"
            ?loading=${this.uploading}
            @click=${() => this.variantInput.click()}
          >
            ${msg('Upload variant')}
          </ui-button>
        </div>
      </ui-card>
      ${this.deleteTarget
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.busy}
            confirmLabel=${msg('Delete')}
            message=${msg(
              'Delete the theme variant? Pages using it fall back to the default.'
            )}
            @confirm=${() => void this.deleteVariant()}
            @cancel=${() => {
              this.deleteTarget = null;
            }}
          ></confirm-dialog>`
        : nothing}
    `;
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Customization')}</h1>
        </div>
        <p class="intro">
          ${msg(
            'Upload replacement logos, favicons and theme CSS. Removing an upload restores the bundled default.'
          )}
        </p>
        ${this.renderThemeSection()}
        <h2>${msg('Branding')}</h2>
        <div class="grid">
          <customization-slot-card
            slot="logo-light"
            heading=${msg('Logo (light)')}
            .defaultSrc=${logoLight}
          ></customization-slot-card>
          <customization-slot-card
            slot="logo-dark"
            heading=${msg('Logo (dark)')}
            .defaultSrc=${logoDark}
          ></customization-slot-card>
          <customization-slot-card
            slot="favicon-light"
            heading=${msg('Favicon (light)')}
            .defaultSrc=${'/favicon-light.svg'}
          ></customization-slot-card>
          <customization-slot-card
            slot="favicon-dark"
            heading=${msg('Favicon (dark)')}
            .defaultSrc=${'/favicon-dark.svg'}
          ></customization-slot-card>
        </div>
      </admin-layout>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .page-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .intro {
      margin: 0 0 24px;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 600;
      color: var(--theme-color-text-secondary);
    }
    h2:not(:first-of-type) {
      margin-top: 28px;
    }
    .theme-card {
      margin-bottom: 8px;
    }
    .theme-selects {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 240px), 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .variant-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 6px 0;
      border-bottom: 1px solid var(--theme-color-border);
    }
    .variant-row:last-child {
      border-bottom: none;
    }
    .variant-name {
      font-size: 14px;
      color: var(--theme-color-text-primary);
      word-break: break-all;
    }
    .empty {
      margin: 0;
      font-size: 13px;
      color: var(--theme-color-text-muted);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
    input.variant-input {
      display: none;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
      gap: 16px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'customization-page': CustomizationPage;
  }
}
