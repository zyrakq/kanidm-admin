// SSH public keys tab for the service account detail page. Self-loads
// the key list (GET /v1/service_account/{id}/_attr/ssh_publickey ->
// Vec<String>) and offers add/remove actions wrapped in step-up auth.
//
// Item format: kanidm stores each sshpublickey value as "tag: key"
// (Value::SshKey display), so the list items carry the tag inline.
// Items that do not match that shape are rendered as bare keys and
// cannot be removed (the delete endpoint is keyed by tag).

import { LitElement, html, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { authService } from '@/features/auth';
import { notificationService } from '@/features/notifications';
import '@/shared/components/ui-button';
import '@/shared/components/ui-card';
import '@/shared/components/ui-empty-state';
import '@/shared/components/ui-skeleton';
import '@/shared/components/form-field';
import { serviceAccountService } from '../services/service-account.service';
import { saSshTabStyles } from './sa-ssh-tab.styles';

interface SshKeyItem {
  tag: string | null;
  key: string;
}

/** Split a "tag: key" list item; fall back to a bare key. */
function parseSshKeyItem(raw: string): SshKeyItem {
  const match = /^([^:\s]+):\s+(\S.*)$/.exec(raw.trim());
  if (match) {
    return { tag: match[1], key: match[2] };
  }
  return { tag: null, key: raw.trim() };
}

@customElement('sa-ssh-tab')
@localized()
export class SaSshTab extends LitElement {
  static styles = saSshTabStyles;

  /** Service account id (name or uuid). */
  @property() id = '';

  @state() private keys: SshKeyItem[] = [];
  @state() private loading = false;
  @state() private loadError: string | null = null;
  @state() private busy = false;
  @state() private formError: string | null = null;
  @state() private tag = '';
  @state() private pubkey = '';

  async connectedCallback() {
    super.connectedCallback();
    await this.loadKeys();
  }

  private async loadKeys(): Promise<void> {
    this.loading = true;
    this.loadError = null;
    try {
      const raw = await serviceAccountService.sshKeys(this.id);
      this.keys = raw.map(parseSshKeyItem);
    } catch {
      this.loadError = msg('Failed to load SSH keys.');
    } finally {
      this.loading = false;
    }
  }

  private handleTagInput(e: CustomEvent<{ value: string }>): void {
    this.tag = e.detail.value;
  }

  private handlePubkeyInput(e: CustomEvent<{ value: string }>): void {
    this.pubkey = e.detail.value;
  }

  private async handleAdd(e: Event): Promise<void> {
    e.preventDefault();
    if (this.busy) {
      return;
    }
    const tag = this.tag.trim();
    const pubkey = this.pubkey.trim();
    if (!tag || !pubkey) {
      this.formError = msg('Please provide both a tag and a public key.');
      return;
    }

    this.busy = true;
    this.formError = null;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.addSshKey(this.id, tag, pubkey)
      );
      notificationService.success(msg('SSH key added.'));
      this.tag = '';
      this.pubkey = '';
      await this.loadKeys();
    } catch {
      this.formError = msg('Failed to add SSH key.');
    } finally {
      this.busy = false;
    }
  }

  private async handleRemove(item: SshKeyItem): Promise<void> {
    if (this.busy || !item.tag) {
      return;
    }
    this.busy = true;
    this.formError = null;
    try {
      await authService.withStepUp(() =>
        serviceAccountService.removeSshKey(this.id, item.tag as string)
      );
      notificationService.success(msg('SSH key removed.'));
      await this.loadKeys();
    } catch {
      notificationService.error(msg('Failed to remove SSH key.'));
    } finally {
      this.busy = false;
    }
  }

  render() {
    return html`
      <h2 class="section-title">${msg('SSH Public Keys')}</h2>
      ${this.loading
        ? html`<ui-skeleton height="56px" .lines=${2}></ui-skeleton>`
        : this.loadError
          ? html`<p class="error" role="alert">${this.loadError}</p>`
          : this.renderKeyList()}
      ${this.renderAddForm()}
    `;
  }

  private renderKeyList() {
    if (this.keys.length === 0) {
      return html`<ui-empty-state class="empty" icon="terminal">
        ${msg('No SSH keys registered.')}
      </ui-empty-state>`;
    }
    return html`
      <ul class="key-list">
        ${this.keys.map(
          (item) => html`
            <li>
              <ui-card interactive>
                <div class="key-item">
                  <div class="key-body">
                    ${item.tag
                      ? html`<p class="key-tag">${item.tag}</p>`
                      : nothing}
                    <p class="key-value">${item.key}</p>
                  </div>
                  <ui-button
                    variant="danger-ghost"
                    size="sm"
                    icon="trash"
                    ?disabled=${this.busy || !item.tag}
                    @click=${() => this.handleRemove(item)}
                  >
                    ${msg('Remove')}
                  </ui-button>
                </div>
              </ui-card>
            </li>
          `
        )}
      </ul>
    `;
  }

  private renderAddForm() {
    return html`
      <ui-card>
        <form class="add-form" @submit=${this.handleAdd}>
          <form-field
            fieldId="sa-ssh-tag"
            label=${msg('Tag')}
            .value=${this.tag}
            ?disabled=${this.busy}
            required
            @field-input=${this.handleTagInput}
          ></form-field>
          <form-field
            fieldId="sa-ssh-pubkey"
            type="textarea"
            label=${msg('Public key')}
            .value=${this.pubkey}
            ?disabled=${this.busy}
            placeholder="ssh-ed25519 AAAA..."
            required
            @field-input=${this.handlePubkeyInput}
          ></form-field>
          ${this.formError
            ? html`<p class="error" role="alert">${this.formError}</p>`
            : nothing}
          <div class="form-actions">
            <ui-button type="submit" variant="primary" icon="plus" ?loading=${this.busy}>
              ${msg('Add Key')}
            </ui-button>
          </div>
        </form>
      </ui-card>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'sa-ssh-tab': SaSshTab;
  }
}
