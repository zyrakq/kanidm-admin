// Avatar: image with initials fallback computed from the display name.
// Persons have no image attribute in kanidm (initials only); oauth2 and
// domain pass an image URL (proxied /ui/images/...).

import { LitElement, css, html } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { localized } from '@/features/localization';

@customElement('ui-avatar')
@localized()
export class UiAvatar extends LitElement {
  /** Image source; when unset (or broken) the initials render. */
  @property() src = '';
  /** Display name used for the initials fallback. */
  @property() name = '';
  @property({ type: Number }) size = 40;

  @state() private imageFailed = false;

  private get initials(): string {
    const parts = this.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) {
      return '?';
    }
    const first = parts[0][0] ?? '';
    const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? '') : '';
    return (first + last).toUpperCase();
  }

  render() {
    const dimension = `${this.size}px`;
    if (this.src && !this.imageFailed) {
      return html`
        <img
          class="avatar"
          src=${this.src}
          alt=${this.name}
          style="width:${dimension};height:${dimension}"
          @error=${() => (this.imageFailed = true)}
        />
      `;
    }
    return html`
      <div
        class="avatar initials"
        style="width:${dimension};height:${dimension};font-size:${Math.floor(
          this.size / 2.5
        )}px"
        aria-hidden="true"
      >
        ${this.initials}
      </div>
    `;
  }

  static styles = css`
    .avatar {
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .initials {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: var(--theme-color-primary);
      color: #ffffff;
      font-weight: 600;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-avatar': UiAvatar;
  }
}
