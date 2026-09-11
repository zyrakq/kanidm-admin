import { LitElement, html, nothing, type PropertyValues } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg, str } from '@lit/localize';
import { localized, LocaleController, LOCALE_METADATA } from '@/features/localization';
import { notificationService } from '@/features/notifications';
import { ThemeController, themeService } from '@/features/theme';
import { authService } from '../services/auth.service';
import type { User } from '../types/auth.types';
import '@/shared/components/avatar';
import '@/shared/components/ui-icon';
import '@/features/localization/components/locale-bottom-sheet';
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
  @state() private drawerOpen = false;
  @state() private sheetOpen = false;

  private ticker: number | null = null;
  private warningNotified = false;
  private theme = new ThemeController(this);
  private localeCtrl = new LocaleController(this);
  private mq = window.matchMedia('(max-width: 768px)');

  connectedCallback(): void {
    super.connectedCallback();
    void authService.init().then(() => this.syncFromService());
    // One-second tick; the display format decides the visible granularity
    // ("Xh Ym" above 1 h, "mm:ss" below).
    this.ticker = window.setInterval(() => this.tick(), 1000);
    this.mq.addEventListener('change', this.handleBreakpointChange);
    window.addEventListener('admin-drawer-open', this.handleAdminDrawerOpen);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    if (this.ticker !== null) {
      window.clearInterval(this.ticker);
      this.ticker = null;
    }
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleDocumentKeyDown);
    this.mq.removeEventListener('change', this.handleBreakpointChange);
    window.removeEventListener('admin-drawer-open', this.handleAdminDrawerOpen);
    document.body.style.overflow = '';
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

  // --- Drawer mode (mobile only; desktop dropdown stays) ---

  private handleBreakpointChange = (e: MediaQueryListEvent): void => {
    // Crossing to desktop: the drawer has no meaning there.
    if (!e.matches && (this.drawerOpen || this.sheetOpen)) {
      this.closeDrawer();
    }
  };

  /** admin-layout opened its burger drawer: get out of the way. */
  private handleAdminDrawerOpen = (): void => {
    if (this.drawerOpen || this.sheetOpen) {
      this.closeDrawer();
    }
  };

  /** Mutual-close FIRST, scroll lock after (contract with
   *  admin-layout: the closing handler clears body.overflow, this
   *  opener re-locks it after the dispatch returns). */
  private openDrawer(): void {
    window.dispatchEvent(new CustomEvent('session-drawer-open'));
    this.drawerOpen = true;
    document.body.style.overflow = 'hidden';
  }

  private closeDrawer(): void {
    this.drawerOpen = false;
    this.sheetOpen = false;
    document.body.style.overflow = '';
  }

  private handleTriggerClick(): void {
    if (this.mq.matches) {
      if (this.drawerOpen) {
        this.closeDrawer();
      } else {
        this.openDrawer();
      }
    } else {
      this.menuOpen = !this.menuOpen;
    }
  }

  private handleThemeToggle(): void {
    void themeService.toggleTheme();
  }

  private toggleSheet(): void {
    this.sheetOpen = !this.sheetOpen;
  }

  private handleDocumentKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== 'Escape') return;
    // Sheet first, then drawer (velora order). The sheet has its own
    // Escape listener that emits close; both converge on the same state.
    if (this.sheetOpen) {
      this.sheetOpen = false;
    } else if (this.drawerOpen) {
      this.closeDrawer();
    }
  };

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
          aria-expanded=${this.menuOpen || this.drawerOpen ? 'true' : 'false'}
          aria-label=${this.avatarName}
          @click=${this.handleTriggerClick}
        >
          ${countdown}
          <ui-avatar
            .name=${this.avatarName}
            size="32"
          ></ui-avatar>
          <ui-icon name="chevron-down" size="16"></ui-icon>
        </button>
        ${this.menuOpen ? this.renderMenu() : nothing}
        ${this.renderDrawer()}
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

  private renderDrawer(): unknown {
    const user = this.user;
    if (!user) {
      return nothing;
    }
    const isDark = this.theme.theme === 'dark';
    const currentLocale = LOCALE_METADATA[this.localeCtrl.locale];

    return html`
      <div
        class="drawer ${this.drawerOpen ? 'open' : ''}"
        role="dialog"
        aria-modal="true"
        aria-label=${msg('Session menu')}
      >
        <div class="drawer-profile">
          <ui-avatar
            .name=${this.avatarName}
            size="56"
          ></ui-avatar>
          <span class="drawer-username"
            >${user.displayName || user.username}</span
          >
          ${user.email
            ? html`<span class="drawer-user-subtitle">${user.email}</span>`
            : nothing}
        </div>

        <div class="drawer-row">
          <ui-icon name="clock" size="20"></ui-icon>
          <span class="drawer-row-label">${msg('Session')}</span>
          ${this.remainingMs !== null
            ? html`<span
                class="countdown ${this.warning ? 'warning' : ''}"
                >${this.formatRemaining(this.remainingMs)}</span
              >`
            : nothing}
        </div>

        <button
          class="drawer-row"
          type="button"
          @click=${this.handleThemeToggle}
          aria-label=${isDark
            ? msg('Switch to light theme')
            : msg('Switch to dark theme')}
        >
          <ui-icon name=${isDark ? 'sun' : 'moon'} size="20"></ui-icon>
          <span class="drawer-row-label">${msg('Dark mode')}</span>
          <div class="theme-track ${isDark ? 'active' : ''}" aria-hidden="true">
            <div class="theme-thumb"></div>
          </div>
        </button>

        <button
          class="drawer-row"
          type="button"
          @click=${this.toggleSheet}
          aria-label=${msg('Change language')}
        >
          <ui-icon name="globe" size="20"></ui-icon>
          <span class="drawer-row-label">${msg('Language')}</span>
          <span class="drawer-row-value">${currentLocale.flag}</span>
          <ui-icon name="chevron-right" size="16"></ui-icon>
        </button>

        <button
          class="drawer-row danger"
          type="button"
          @click=${() => void this.handleSignOut()}
        >
          <ui-icon name="log-out" size="20"></ui-icon>
          <span class="drawer-row-label">${msg('Sign Out')}</span>
        </button>
      </div>

      <locale-bottom-sheet
        ?open=${this.sheetOpen}
        @close=${() => (this.sheetOpen = false)}
        @locale-selected=${() => (this.sheetOpen = false)}
      ></locale-bottom-sheet>
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
    if (changed.has('drawerOpen')) {
      if (this.drawerOpen) {
        document.addEventListener('keydown', this.handleDocumentKeyDown);
      } else {
        document.removeEventListener('keydown', this.handleDocumentKeyDown);
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
