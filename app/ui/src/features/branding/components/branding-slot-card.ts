// One branding slot: preview (override or bundled default), upload and
// remove actions. The preview URL is cache-busted after each mutation.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import { brandingService } from '../services/branding.service';
import type { BrandingSlot } from '../types/branding.types';

@customElement('branding-slot-card')
@localized()
export class BrandingSlotCard extends LitElement {
  @property() slot: BrandingSlot = 'logo-light';
  /** Localized card title, set by the page. */
  @property() heading = '';
  /** Bundled default asset URL for the preview fallback. */
  @property() defaultSrc = '';

  @query('input[type="file"]') private fileInput!: HTMLInputElement;

  @state() private busy = false;
  @state() private removeOpen = false;
  @state() private removing = false;
  @state() private previewMissing = false;
  /** Bumped after upload/remove so the preview reloads. */
  @state() private version = 0;

  private get previewUrl(): string {
    const override = brandingService.overrideUrl(this.slot);
    if (override) return `${override}&c=${this.version}`;
    return `${this.defaultSrc}?c=${this.version}`;
  }

  private async upload(file: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await brandingService.upload(this.slot, file);
      this.previewMissing = false;
      this.version += 1;
      notificationService.success(msg('Image uploaded.'));
    } catch {
      notificationService.error(msg('Failed to upload the image.'));
    } finally {
      this.busy = false;
    }
  }

  private async removeImage(): Promise<void> {
    if (this.removing) return;
    this.removing = true;
    try {
      await brandingService.remove(this.slot);
      this.removeOpen = false;
      this.previewMissing = false;
      this.version += 1;
      notificationService.success(msg('Image removed.'));
    } catch {
      notificationService.error(msg('Failed to remove the image.'));
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
    const hasOverride = brandingService.overrideUrl(this.slot) !== null;
    return html`
      <ui-card class="card">
        <h2>${this.heading}</h2>
        <div class="preview">
          ${
            this.previewMissing
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
            accept="image/svg+xml,image/png"
            @change=${this.handleFileChange}
          />
          <ui-button
            variant="primary"
            ?loading=${this.busy}
            @click=${() => this.fileInput.click()}
          >
            ${msg('Upload image')}
          </ui-button>
          <ui-button
            variant="danger"
            ?disabled=${!hasOverride || this.busy}
            @click=${() => {
              this.removeOpen = true;
            }}
          >
            ${msg('Remove image...')}
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
              message=${msg('Remove the uploaded image? The default returns.')}
              @confirm=${() => void this.removeImage()}
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
    'branding-slot-card': BrandingSlotCard;
  }
}
