import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { personService } from '../services/person.service';
import { authService } from '@/features/auth/services/auth.service';
import { notificationService } from '@/features/notifications';
import { personRadiusTabStyles } from './person-radius-tab.styles';

@customElement('person-radius-tab')
@localized()
export class PersonRadiusTab extends LitElement {
  @property({ type: String }) id = '';

  @state() private secret: string | null = null;
  @state() private loading = true;
  @state() private busy = false;
  @state() private revealed = false;
  /** Freshly generated secret — displayed once with a copy button. */
  @state() private newSecret: string | null = null;

  static styles = [personRadiusTabStyles];

  connectedCallback() {
    super.connectedCallback();
    void this.load();
  }

  private async load(): Promise<void> {
    this.loading = true;
    try {
      this.secret = await personService.radiusGet(this.id);
    } catch (error) {
      this.secret = null;
      notificationService.error(
        error instanceof Error
          ? error.message
          : msg('Failed to load the RADIUS secret.')
      );
    } finally {
      this.loading = false;
    }
  }

  private async regenerate(): Promise<void> {
    this.busy = true;
    try {
      const secret = await authService.withStepUp(() =>
        personService.radiusRegenerate(this.id)
      );
      this.secret = secret;
      this.newSecret = secret;
      this.revealed = true;
      notificationService.success(msg('RADIUS secret regenerated.'));
    } catch (error) {
      notificationService.error(
        error instanceof Error
          ? error.message
          : msg('Failed to regenerate the RADIUS secret.')
      );
    } finally {
      this.busy = false;
    }
  }

  private async deleteSecret(): Promise<void> {
    this.busy = true;
    try {
      await authService.withStepUp(() => personService.radiusDelete(this.id));
      this.secret = null;
      this.newSecret = null;
      this.revealed = false;
      notificationService.success(msg('RADIUS secret deleted.'));
    } catch (error) {
      notificationService.error(
        error instanceof Error
          ? error.message
          : msg('Failed to delete the RADIUS secret.')
      );
    } finally {
      this.busy = false;
    }
  }

  private async copySecret(): Promise<void> {
    const value = this.newSecret ?? this.secret;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      notificationService.success(msg('Copied to clipboard.'));
    } catch {
      notificationService.error(msg('Failed to copy to clipboard.'));
    }
  }

  private toggleReveal(): void {
    this.revealed = !this.revealed;
  }

  private dismissNewSecret(): void {
    this.newSecret = null;
  }

  private renderLoading() {
    return html`<p class="muted">${msg('Loading…')}</p>`;
  }

  private renderEmpty() {
    return html`
      <div class="section">
        <h3 class="section-title">${msg('RADIUS')}</h3>
        <div class="card">
          <p class="muted">${msg('No RADIUS secret is set for this account.')}</p>
          <div class="actions">
            <button
              class="primary"
              ?disabled=${this.busy}
              @click=${this.regenerate}
            >
              ${msg('Generate secret')}
            </button>
          </div>
        </div>
      </div>
    `;
  }

  private renderSecret() {
    const display = this.newSecret ?? this.secret ?? '';
    const masked = '•'.repeat(Math.min(display.length, 24));
    return html`
      <div class="section">
        <h3 class="section-title">${msg('RADIUS')}</h3>
        <div class="card">
          ${this.newSecret
            ? html`<p class="muted">
                ${msg(
                  'New secret generated — copy it now, it will not be shown again.'
                )}
              </p>`
            : nothing}
          <div class="secret-row">
            <span class="secret">
              ${this.revealed || this.newSecret ? display : masked}
            </span>
            ${this.newSecret
              ? nothing
              : html`<button class="secondary" @click=${this.toggleReveal}>
                  ${this.revealed ? msg('Hide') : msg('Reveal')}
                </button>`}
            <button class="secondary" @click=${this.copySecret}>
              ${msg('Copy')}
            </button>
          </div>
          <div class="actions">
            <button
              class="primary"
              ?disabled=${this.busy}
              @click=${this.regenerate}
            >
              ${msg('Regenerate secret')}
            </button>
            <button
              class="danger"
              ?disabled=${this.busy}
              @click=${this.deleteSecret}
            >
              ${msg('Delete secret')}
            </button>
            ${this.newSecret
              ? html`<button class="secondary" @click=${this.dismissNewSecret}>
                  ${msg('Done')}
                </button>`
              : nothing}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    if (this.loading) {
      return this.renderLoading();
    }
    return this.secret === null ? this.renderEmpty() : this.renderSecret();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'person-radius-tab': PersonRadiusTab;
  }
}
