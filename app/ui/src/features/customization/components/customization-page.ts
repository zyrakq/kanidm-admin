// Customization admin page: four upload cards (light/dark logo and favicon)
// plus a note that deleting restores the bundled defaults.

import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import logoLight from '@/assets/logo-light.svg';
import logoDark from '@/assets/logo-dark.svg';
import { customizationService } from '../services/customization.service';
import './customization-slot-card';

@customElement('customization-page')
@localized()
export class CustomizationPage extends LitElement {
  async connectedCallback(): Promise<void> {
    super.connectedCallback();
    await customizationService.init();
  }

  render() {
    return html`
      <admin-layout>
        <div class="page-head">
          <h1>${msg('Customization')}</h1>
        </div>
        <p class="intro">
          ${msg(
            'Upload replacement logos and favicons. Removing an upload restores the bundled default.'
          )}
        </p>
        <div class="grid">
          <customization-slot-card
            slot="logo-light"
            heading=${msg('Logo (light)')}
            .defaultSrc=${logoLight}
          ></customization-slot-card>
          <customization-slot-card
            slot="logo-dark"
            heading=${msg('Logo (dark)')}
            .defaultSrc=${logoDark}
          ></customization-slot-card>
          <customization-slot-card
            slot="favicon-light"
            heading=${msg('Favicon (light)')}
            .defaultSrc=${'/favicon-light.svg'}
          ></customization-slot-card>
          <customization-slot-card
            slot="favicon-dark"
            heading=${msg('Favicon (dark)')}
            .defaultSrc=${'/favicon-dark.svg'}
          ></customization-slot-card>
        </div>
      </admin-layout>
    `;
  }

  static styles = css`
    :host {
      display: block;
    }
    .page-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    h1 {
      margin: 0;
      font-size: 20px;
      font-weight: 600;
      color: var(--theme-color-text-primary);
    }
    .intro {
      margin: 0 0 16px;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 16px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'customization-page': CustomizationPage;
  }
}
