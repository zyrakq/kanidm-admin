// app/ui/src/shared/components/version-banner.ts
//
// Non-blocking compatibility banner: when the live Kanidm server sits
// outside what this build claims to cover, it explains the drift in
// place of the old hard "version conflict" wall — the app keeps working
// (Kanidm's v1 JSON API is stable across minors).
//
// - amber (`version_warning`): same major, minor outside the advertised
//   ±1 band around the pinned kanidm_client version.
// - red (`version_conflict`): major mismatch — the API contract may be
//   broken entirely.
//
// Hidden for every other state. Dismissable with ✕; the dismissal is
// stored in sessionStorage keyed by `state:serverVersion`, so the same
// drift stays dismissed for the session but a changed state or server
// version shows the banner again.

import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import {
  kanidmStatusService,
  KanidmStatusService,
} from '../services/kanidm-status.service';
import type { KanidmStatus } from '../services/kanidm-status.service';
import '@/shared/components/ui-icon';
import { versionBannerStyles } from './version-banner.styles';

/** sessionStorage key; value is `<state>:<serverVersion>` per dismissal. */
const VERSION_BANNER_STORAGE_KEY = 'kanidm-admin.version-banner-dismissed';

@customElement('version-banner')
@localized()
export class VersionBanner extends LitElement {
  @state() private status: KanidmStatus | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    this.status = kanidmStatusService.getLastKnownStatus();
    window.addEventListener(
      KanidmStatusService.STATUS_EVENT,
      this.handleStatusChanged
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener(
      KanidmStatusService.STATUS_EVENT,
      this.handleStatusChanged
    );
  }

  private handleStatusChanged = (e: Event): void => {
    this.status = (e as CustomEvent<KanidmStatus>).detail;
  };

  /** Dismissal key must change when the drift itself changes. */
  private keyOf(s: KanidmStatus): string {
    return `${s.state}:${s.serverVersion ?? '-'}`;
  }

  private get isDismissed(): boolean {
    if (!this.status) return false;
    return (
      sessionStorage.getItem(VERSION_BANNER_STORAGE_KEY) ===
      this.keyOf(this.status)
    );
  }

  private handleDismiss = (): void => {
    if (this.status) {
      sessionStorage.setItem(
        VERSION_BANNER_STORAGE_KEY,
        this.keyOf(this.status)
      );
      this.requestUpdate();
    }
  };

  private renderBanner(s: KanidmStatus) {
    const isError = s.state === 'version_conflict';
    const title = isError
      ? msg('Incompatible Kanidm version')
      : msg('Untested Kanidm version');
    const detail = isError
      ? msg(
          str`This panel targets Kanidm ${s.clientVersion ?? '—'}, but the server reports ${s.serverVersion ?? '—'}. Some features may be broken.`
        )
      : msg(
          str`This panel was tested with Kanidm ${s.supportedRange ?? '—'} — the server reports ${s.serverVersion ?? '—'}. Some features may not work.`
        );
    return html`
      <div class="banner ${isError ? 'error' : 'warning'}" role="alert">
        <ui-icon class="icon" name="warning" size="18"></ui-icon>
        <span class="text">
          <span class="title">${title}</span>
          <span class="detail">${detail}</span>
        </span>
        <button
          class="close"
          type="button"
          aria-label=${msg('Close')}
          title=${msg('Close')}
          @click=${this.handleDismiss}
        >
          <ui-icon name="x" size="16"></ui-icon>
        </button>
      </div>
    `;
  }

  protected render() {
    if (!this.status || this.isDismissed) return nothing;
    switch (this.status.state) {
      case 'version_warning':
      case 'version_conflict':
        return this.renderBanner(this.status);
      default:
        return nothing;
    }
  }

  static styles = versionBannerStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'version-banner': VersionBanner;
  }
}
