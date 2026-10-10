// One customization slot: upload and remove actions for image slots
// (logo/favicon). Renders an <img> preview (override or bundled
// default); the preview URL is cache-busted after each mutation.
// Theme variants are handled by the theme section on the page.

import { LitElement, css, html } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import { customizationService } from '../services/customization.service';
import type { CustomizationSlot } from '../types/customization.types';

@customElement('customization-slot-card')
@localized()
export class CustomizationSlotCard extends LitElement {
  @property() slot: CustomizationSlot = 'logo-light';
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
    const override = customizationService.overrideUrl(this.slot);
    if (override) return `${override}&c=${this.version}`;
    return `${this.defaultSrc}?c=${this.version}`;
  }

  private async upload(file: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await customizationService.upload(this.slot, file);
      this.previewMissing = false;
      this.version += 1;
      notificationService.success(msg('Image uploaded.'));
    } catch {
      notificationService.error(msg('Failed to upload the image.'));
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
    const hasOverride = customizationService.overrideUrl(this.slot) !== null;
    return html`
      <ui-card class="card" stretch>
        <h2>${this.heading}</h2>
        <div class="preview">
          ${this.previewMissing
            ? html`<div class="placeholder">${msg('No image')}</div>`
            : html`<img
                src=${this.previewUrl}
                alt=${this.heading}
                @error=${() => {
                  this.previewMissing = true;
                }}
              />`}
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
      ${this.removeOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.removing}
            confirmLabel=${msg('Remove')}
            message=${msg('Remove the uploaded image? The default returns.')}
            @confirm=${() => void this.removeOverride()}
            @cancel=${() => {
              this.removeOpen = false;
            }}
          ></confirm-dialog>`
        : ''}
    `;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
    }
    ui-card {
      flex: 1;
    }
    .card h2 {
      margin: 0 0 16px;
      font-size: 16px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .preview {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 96px;
    }
    .preview img {
      display: block;
      max-width: 100%;
      height: auto;
    }
    .placeholder {
      font-size: 13px;
      color: var(--theme-color-text-muted);
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: auto;
      padding-top: 24px;
    }
    .actions ui-button {
      flex: 1 1 auto;
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
