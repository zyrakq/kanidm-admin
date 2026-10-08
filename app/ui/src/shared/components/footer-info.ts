import { LitElement, html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { kanidmStatusService } from '../services/kanidm-status.service';
import type { KanidmStatus } from '../services/kanidm-status.service';
import { footerInfoStyles } from './footer-info.styles';

/** Footer polls the backend status endpoint at this interval. */
const STATUS_POLL_INTERVAL_MS = 30_000;

@customElement('footer-info')
@localized()
export class FooterInfo extends LitElement {
  @state() private status: KanidmStatus | null = null;

  private poller: number | null = null;

  connectedCallback(): void {
    super.connectedCallback();
    // Paint the last known state instantly (SPA re-mounts), then refresh.
    this.status = kanidmStatusService.getLastKnownStatus();
    void this.refreshStatus();
    this.poller = window.setInterval(
      () => void this.refreshStatus(),
      STATUS_POLL_INTERVAL_MS
    );
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.poller !== null) {
      window.clearInterval(this.poller);
      this.poller = null;
    }
  }

  private async refreshStatus(): Promise<void> {
    this.status = await kanidmStatusService.fetchStatus();
  }

  private renderStatus() {
    if (!this.status) {
      // Loading: muted dot + ellipsis (locale-independent symbol).
      return html`
        <span class="status" data-state="loading">
          <span class="status-dot"></span>
          …
        </span>
      `;
    }
    switch (this.status.state) {
      case 'alive':
        return html`
          <span class="status" data-state="alive">
            <span class="status-dot"></span>
            ${this.status.serverVersion
              ? msg(str`Kanidm v${this.status.serverVersion}`)
              : msg('Kanidm v—')}
          </span>
        `;
      case 'unreachable':
        return html`
          <span class="status" data-state="unreachable">
            <span class="status-dot"></span>
            ${msg('Kanidm unavailable')}
          </span>
        `;
      case 'version_warning':
        return html`
          <span
            class="status"
            data-state="version_warning"
            title=${msg(
              str`Client ${this.status.clientVersion ?? '—'} / Server ${
                this.status.serverVersion ?? '—'
              } / Supported range ${this.status.supportedRange ?? '—'}`
            )}
          >
            <span class="status-dot"></span>
            ${msg('Untested version')}
          </span>
        `;
      case 'version_conflict':
        return html`
          <span
            class="status"
            data-state="version_conflict"
            title=${msg(
              str`Client ${this.status.clientVersion ?? '—'} / Server ${
                this.status.serverVersion ?? '—'
              } / Supported range ${this.status.supportedRange ?? '—'}`
            )}
          >
            <span class="status-dot"></span>
            ${msg('Incompatible version')}
          </span>
        `;
    }
  }

  render() {
    return html`
      <footer>
        <div class="toolbar">
          <div class="left">${this.renderStatus()}</div>
          <div class="spacer"></div>
          <div class="right">
            <a
              href="https://github.com/zyrakq/kanidm-admin"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${msg('GitHub')}
            </a>
            <span class="separator">•</span>
            <a
              href="https://kanidm.github.io/kanidm/stable/"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${msg('Kanidm Docs')}
            </a>
            <span class="separator">•</span>
            <a
              href="https://github.com/kanidm/kanidm"
              target="_blank"
              rel="noopener noreferrer"
            >
              ${msg('Kanidm GitHub')}
            </a>
          </div>
        </div>
      </footer>
    `;
  }

  static styles = footerInfoStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'footer-info': FooterInfo;
  }
}
