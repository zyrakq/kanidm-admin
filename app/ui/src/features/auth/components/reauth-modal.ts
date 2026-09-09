import { LitElement, html, nothing } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '../services/auth.service';
import { reauthModalStyles } from './reauth-modal.styles';

// Global step-up modal. The auth service opens it via the
// 'auth-step-up-open' window event and awaits the password through
// authService.submitStepUp / cancelStepUp.

@customElement('reauth-modal')
@localized()
export class ReauthModal extends LitElement {
  @state() private isOpen = false;
  @state() private hasError = false;
  @state() private password = '';
  @state() private pending = false;

  connectedCallback(): void {
    super.connectedCallback();
    window.addEventListener('auth-step-up-open', this.handleStepUpRequest);
    window.addEventListener('keydown', this.handleKeyDown);
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    window.removeEventListener('auth-step-up-open', this.handleStepUpRequest);
    window.removeEventListener('keydown', this.handleKeyDown);
    document.body.style.overflow = '';
  }

  private handleStepUpRequest = (event: Event): void => {
    const detail = (event as CustomEvent<{ error: string | null }>).detail;
    // The raw backend message is English; the modal localizes by the
    // presence of the error flag (it is always invalid_credentials).
    this.hasError = detail?.error != null;
    this.password = '';
    this.pending = false;
    this.open();
  };

  private open(): void {
    this.isOpen = true;
    document.body.style.overflow = 'hidden';
  }

  private close(): void {
    this.isOpen = false;
    this.password = '';
    this.pending = false;
    document.body.style.overflow = '';
  }

  private handleKeyDown = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && this.isOpen && !this.pending) {
      this.handleCancel();
    }
  };

  private handleOverlayClick(e: MouseEvent): void {
    if (e.target === e.currentTarget && !this.pending) {
      this.handleCancel();
    }
  }

  private handlePasswordInput(e: Event): void {
    this.password = (e.target as HTMLInputElement).value;
  }

  private handleCancel(): void {
    this.close();
    authService.cancelStepUp();
  }

  private handleSubmit(e: Event): void {
    e.preventDefault();
    if (this.pending || !this.password) {
      return;
    }
    // The service performs the reauth call and re-opens this modal with
    // an error flag when the password is wrong.
    const password = this.password;
    this.pending = true;
    this.close();
    authService.submitStepUp(password);
  }

  render() {
    if (!this.isOpen) {
      return nothing;
    }

    return html`
      <div class="modal-overlay" @click=${this.handleOverlayClick}>
        <div class="modal-card">
          <div class="modal-header">
            <span class="modal-title"
              >${msg('Elevated access required')}</span
            >
          </div>
          <div class="modal-content">
            <p class="modal-message">
              ${msg(
                'This operation requires elevated privileges. Enter your password to continue.'
              )}
            </p>
            <form class="form" @submit=${this.handleSubmit}>
              <div class="field">
                <label class="label" for="reauth-password"
                  >${msg('Password')}</label
                >
                <input
                  id="reauth-password"
                  class="input"
                  type="password"
                  autocomplete="current-password"
                  .value=${this.password}
                  @input=${this.handlePasswordInput}
                  autofocus
                />
              </div>
              ${this.hasError
                ? html`<p class="error" role="alert">
                    ${msg('Invalid username or password.')}
                  </p>`
                : nothing}
              <div class="actions">
                <button
                  class="btn btn-secondary"
                  type="button"
                  @click=${this.handleCancel}
                >
                  ${msg('Cancel')}
                </button>
                <button
                  class="btn btn-primary"
                  type="submit"
                  ?disabled=${!this.password}
                >
                  ${msg('Confirm')}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    `;
  }

  static styles = reauthModalStyles;
}

declare global {
  interface HTMLElementTagNameMap {
    'reauth-modal': ReauthModal;
  }
}
