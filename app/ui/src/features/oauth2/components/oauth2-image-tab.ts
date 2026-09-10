// OAuth2 image tab: shows the client image preview (with a fallback
// placeholder when no image exists), an upload form and a remove
// action with confirm. The preview URL is cache-busted after each
// mutation so the new state is visible immediately.

import { LitElement, css, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/confirm-dialog';
import { oauth2Service } from '../services/oauth2.service';

@customElement('oauth2-image-tab')
@localized()
export class Oauth2ImageTab extends LitElement {
  /** Client id (name or uuid). */
  @property() id = '';

  @state() private busy = false;
  @state() private removeOpen = false;
  @state() private removing = false;
  @state() private imageMissing = false;
  /** Cache-buster bumped after upload/remove to refresh the preview. */
  @state() private version = 0;

  private get previewUrl(): string {
    return `${oauth2Service.imageUrl(this.id)}?v=${this.version}`;
  }

  private async uploadImage(file: File): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    try {
      await authService.withStepUp(() => oauth2Service.setImage(this.id, file));
      this.imageMissing = false;
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
      await authService.withStepUp(() => oauth2Service.removeImage(this.id));
      this.removeOpen = false;
      this.imageMissing = true;
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
    if (file) {
      void this.uploadImage(file);
    }
  }

  render() {
    return html`
      <section class="card">
        <h2>${msg('Client image')}</h2>
        <p class="muted">
          ${msg('Shown on the consent screen next to the client name.')}
        </p>
        <div class="preview">
          ${this.imageMissing
            ? html`<div class="placeholder">${msg('No image')}</div>`
            : html`<img
                src=${this.previewUrl}
                alt=${msg('Client image')}
                @error=${() => {
                  this.imageMissing = true;
                }}
              />`}
        </div>
        <div class="actions">
          <label class="primary-btn file-label">
            <input type="file" accept="image/*" @change=${this.handleFileChange} />
            ${this.busy ? msg('Uploading...') : msg('Upload image')}
          </label>
          <button
            class="danger-btn"
            ?disabled=${this.imageMissing || this.busy}
            @click=${() => {
              this.removeOpen = true;
            }}
          >
            ${msg('Remove image...')}
          </button>
        </div>
      </section>
      ${this.removeOpen
        ? html`<confirm-dialog
            open
            danger
            .busy=${this.removing}
            confirmLabel=${msg('Remove')}
            message=${msg('Remove the client image?')}
            @confirm=${() => void this.removeImage()}
            @cancel=${() => {
              this.removeOpen = false;
            }}
          ></confirm-dialog>`
        : nothing}
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .muted {
      margin: 0 0 12px;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    .card {
      background: var(--theme-color-surface);
      border: 1px solid var(--theme-color-border);
      border-radius: 8px;
      padding: 20px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
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
      border-radius: 8px;
      overflow: hidden;
      background: var(--theme-color-background);
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
    .file-label input[type='file'] {
      display: none;
    }
    .primary-btn,
    .danger-btn {
      padding: 9px 16px;
      border: none;
      border-radius: 6px;
      font: inherit;
      font-weight: 500;
      cursor: pointer;
      transition: background-color 0.2s ease;
    }
    .primary-btn {
      display: inline-block;
      background: var(--theme-color-primary);
      color: var(--theme-color-surface);
    }
    .primary-btn:hover:not(:disabled) {
      background: var(--theme-color-primary-hover);
    }
    .danger-btn {
      background: var(--theme-color-error);
      color: var(--theme-color-surface);
    }
    .danger-btn:hover:not(:disabled) {
      filter: brightness(0.9);
    }
    .primary-btn:disabled,
    .danger-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'oauth2-image-tab': Oauth2ImageTab;
  }
}
