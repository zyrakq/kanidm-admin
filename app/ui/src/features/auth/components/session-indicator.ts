import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import { authService } from '../services/auth.service';
import type { User } from '../types/auth.types';
import '@/shared/components/avatar';
import '@/shared/components/ui-icon';
import { sessionIndicatorStyles } from './session-indicator.styles';

/** Below this remaining time the countdown switches to warning styling. */
const WARNING_THRESHOLD_MS = 5 * 60 * 1000;

@customElement('session-indicator')
@localized()
export class SessionIndicator extends LitElement {
  @state() private user: User | null = null;
  @state() private remainingMs: number | null = null;
  @state() private warning = false;
  @state() private menuOpen = false;

  private ticker: number | null = null;
  private warningNotified = false;

  connectedCallback(): void {
    super.connectedCallback();
    void authService.init().then(() => this.syncFromService());
    // One-second tick; the display format decides the visible granularity
    // ("Xh Ym" above 1 h, "mm:ss" below).
    this.ticker = window.setInterval(() => this.tick(), 1000);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    document.removeEventListener('click', this.handleDocumentClick);
  }

  private remainingOf(expiresAt: number | null): number | null {
    return expiresAt !== null ? Math.max(0, expiresAt - Date.now()) : null;
  }

  private syncFromService(): void {
    const state = authService.getAuthState();
    this.user = state.user;
    this.remainingMs = this.remainingOf(state.sessionExpiresAt);
    this.warning =
      this.remainingMs !== null && this.remainingMs <= WARNING_THRESHOLD_MS;
  }

  private tick(): void {
    if (!authService.isAuthenticated()) {
      this.user = null;
      this.remainingMs = null;
      this.warning = false;
      return;
    }

    const state = authService.getAuthState();
    this.user = state.user;
    this.remainingMs = this.remainingOf(state.sessionExpiresAt);
    this.warning =
      this.remainingMs !== null && this.remainingMs <= WARNING_THRESHOLD_MS;

    if (this.warning && !this.warningNotified) {
      this.warningNotified = true;
      notificationService.warning(
        msg('Your session expires in less than 5 minutes.')
      );
    }

    if (this.remainingMs === 0) {
      // Local sign-out: the session is dead server-side anyway.
      void authService.handleSessionExpired();
    }
  }

  private async handleSignOut(): Promise<void> {
    await authService.signOut();
    window.location.assign('/');
  }

  private formatRemaining(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000);
    if (totalSeconds >= 3600) {
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      return msg(str`${hours}h ${minutes}m`);
    }
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return msg(str`${minutes}:${seconds}`);
  }

  private get avatarName(): string {
    return this.user?.displayName || this.user?.username || '';
  }

  render() {
    if (!this.user) {
      return nothing;
    }

    const countdown =
      this.remainingMs !== null
        ? html`<span
            class="countdown ${this.warning ? 'warning' : ''}"
            aria-label=${msg('Session time remaining')}
            >${this.formatRemaining(this.remainingMs)}</span
          >`
        : nothing;

    return html`
      <div class="indicator" @keydown=${this.handleKeyDown}>
        <button
          class="avatar-btn"
          type="button"
          aria-haspopup="menu"
          aria-expanded=${this.menuOpen ? 'true' : 'false'}
          aria-label=${this.avatarName}
          @click=${() => (this.menuOpen = !this.menuOpen)}
        >
          <ui-avatar .name=${this.avatarName} size="32"></ui-avatar>
          <ui-icon name="chevron-down" size="16"></ui-icon>
          ${countdown}
        </button>
        ${this.menuOpen ? this.renderMenu() : nothing}
      </div>
    `;
  }

  private renderMenu() {
    const user = this.user;
    if (!user) {
      return nothing;
    }
    return html`
      <div class="menu" role="menu">
        <div class="menu-header">
          <p class="display-name">${user.displayName || user.username}</p>
          <p class="user-meta">${user.username}</p>
          ${user.email
            ? html`<p class="user-meta">${user.email}</p>`
            : nothing}
        </div>
        <div class="divider"></div>
        <div class="session-row">
          <span class="session-label">${msg('Session')}</span>
          ${this.remainingMs !== null
            ? html`<span
                class="countdown ${this.warning ? 'warning' : ''}"
                >${this.formatRemaining(this.remainingMs)}</span
              >`
            : nothing}
        </div>
        <div class="divider"></div>
        <button class="sign-out" role="menuitem" @click=${this.handleSignOut}>
          ${msg('Sign Out')}
        </button>
      </div>
    `;
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Escape' && this.menuOpen) {
      this.menuOpen = false;
    }
  }

  private handleDocumentClick = (e: Event): void => {
    if (!e.composedPath().includes(this)) {
      this.menuOpen = false;
    }
  };

  protected updated(changed: PropertyValues): void {
    if (changed.has('menuOpen')) {
      if (this.menuOpen) {
        document.addEventListener('click', this.handleDocumentClick);
      } else {
        document.removeEventListener('click', this.handleDocumentClick);
      }
    }
  }

  static styles = sessionIndicatorStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'session-indicator': SessionIndicator;
  }
}
