// One customization slot: preview (override or bundled default), upload
// and remove actions. Image slots render an <img> preview; CSS slots
// fetch the override text and show a truncated code preview. The
// preview URL is cache-busted after each mutation.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import { customizationService } from '../services/customization.service';
import type { CustomizationSlot } from '../types/customization.types';

/** Characters of CSS shown in the code preview before truncation. */
const CSS_PREVIEW_LIMIT = 400;

@customElement('customization-slot-card')
@localized()
export class CustomizationSlotCard extends LitElement {
  @property() slot: CustomizationSlot = 'logo-light';
  /** 'image' renders an <img> preview; 'css' renders fetched code text. */
  @property() kind: 'image' | 'css' = 'image';
  /** Localized card title, set by the page. */
  @property() heading = '';
  /** Bundled default asset URL for the preview fallback (image kind). */
  @property() defaultSrc = '';

  @query('input[type="file"]') private fileInput!: HTMLInputElement;

  @state() private busy = false;
  @state() private removeOpen = false;
  @state() private removing = false;
  @state() private previewMissing = false;
  /** Truncated override CSS text (css kind); null when unset/unavailable. */
  @state() private cssPreview: string | null = null;
  /** Bumped after upload/remove so the preview reloads. */
  @state() private version = 0;

  private get isCss(): boolean {
    return this.kind === 'css';
  }

  private get previewUrl(): string {
    const override = customizationService.overrideUrl(this.slot);
    if (override) return `${override}&c=${this.version}`;
    return `${this.defaultSrc}?c=${this.version}`;
  }

  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    if (this.isCss) await this.loadCssPreview();
  }

  /** Fetch the override stylesheet and truncate it for the preview. */
  private async loadCssPreview(): Promise<void> {
    const override = customizationService.overrideUrl(this.slot);
    if (!override) {
      this.cssPreview = null;
      return;
    }
    try {
      const res = await fetch(`${override}&c=${this.version}`);
      const text = await res.text();
      this.cssPreview =
        text.length > CSS_PREVIEW_LIMIT
          ? `${text.slice(0, CSS_PREVIEW_LIMIT)}…`
          : text;
    } catch {
      this.cssPreview = null;
    }
  }

  private async upload(file: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await customizationService.upload(this.slot, file);
      this.previewMissing = false;
      this.version += 1;
      if (this.isCss) await this.loadCssPreview();
      notificationService.success(
        this.isCss ? msg('CSS uploaded.') : msg('Image uploaded.')
      );
    } catch {
      notificationService.error(
        this.isCss
          ? msg('Failed to upload the CSS.')
          : msg('Failed to upload the image.')
      );
    } finally {
      this.busy = false;
    }
  }

  private async removeOverride(): Promise<void> {
    if (this.removing) return;
    this.removing = true;
    try {
      await customizationService.remove(this.slot);
      this.removeOpen = false;
      this.previewMissing = false;
      this.version += 1;
      if (this.isCss) await this.loadCssPreview();
      notificationService.success(
        this.isCss ? msg('CSS removed.') : msg('Image removed.')
      );
    } catch {
      notificationService.error(
        this.isCss
          ? msg('Failed to remove the CSS.')
          : msg('Failed to remove the image.')
      );
    } finally {
      this.removing = false;
    }
  }

  private handleFileChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (file) void this.upload(file);
  }

  render() {
    const hasOverride = customizationService.overrideUrl(this.slot) !== null;
    const accept = this.isCss ? '.css,text/css' : 'image/svg+xml,image/png';
    return html`
      <ui-card class="card">
        <h2>${this.heading}</h2>
        <div class="preview">
          ${
            this.isCss
              ? html`<pre class="code-preview">
                  ${this.cssPreview ?? msg('No custom styles')}
                </pre>`
              : this.previewMissing
                ? html`<div class="placeholder">${msg('No image')}</div>`
                : html`<img
                    src=${this.previewUrl}
                    alt=${this.heading}
                    @error=${() => {
                      this.previewMissing = true;
                    }}
                  />`
          }
        </div>
        <div class="actions">
          <input
            type="file"
            accept=${accept}
            @change=${this.handleFileChange}
          />
          <ui-button
            variant="primary"
            ?loading=${this.busy}
            @click=${() => this.fileInput.click()}
          >
            ${this.isCss ? msg('Upload CSS') : msg('Upload image')}
          </ui-button>
          <ui-button
            variant="danger"
            ?disabled=${!hasOverride || this.busy}
            @click=${() => {
              this.removeOpen = true;
            }}
          >
            ${this.isCss ? msg('Remove CSS...') : msg('Remove image...')}
          </ui-button>
        </div>
      </ui-card>
      ${
        this.removeOpen
          ? html`<confirm-dialog
              open
              danger
              .busy=${this.removing}
              confirmLabel=${msg('Remove')}
              message=${
                this.isCss
                  ? msg('Remove the uploaded CSS? The default returns.')
                  : msg('Remove the uploaded image? The default returns.')
              }
              @confirm=${() => void this.removeOverride()}
              @cancel=${() => {
                this.removeOpen = false;
              }}
            ></confirm-dialog>`
          : nothing
      }
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .card h2 {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .preview {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 160px;
      height: 160px;
      margin-bottom: 16px;
      border: 1px dashed var(--theme-color-border);
      border-radius: var(--theme-radius-md);
      overflow: hidden;
      background: var(--theme-color-surface-sunken);
    }
    .preview img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
    }
    .code-preview {
      margin: 0;
      align-self: stretch;
      width: 100%;
      max-height: 140px;
      overflow: auto;
      font-family: var(--theme-font-mono, monospace);
      font-size: 12px;
      line-height: 1.5;
      color: var(--theme-color-text-secondary);
      white-space: pre-wrap;
      word-break: break-word;
      text-align: left;
    }
    .placeholder {
      font-size: 13px;
      color: var(--theme-color-text-muted);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
    }
    input[type='file'] {
      display: none;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'customization-slot-card': CustomizationSlotCard;
  }
}
