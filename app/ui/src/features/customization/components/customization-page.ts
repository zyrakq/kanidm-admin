// Customization admin page, split into two subsections: theme styles
// (light/dark CSS overrides) and branding (light/dark logo and favicon).
// Deleting an upload restores the bundled default.

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
            'Upload replacement logos, favicons and theme CSS. Removing an upload restores the bundled default.'
          )}
        </p>
        <h2>${msg('Theme styles')}</h2>
        <div class="grid">
          <customization-slot-card
            slot="theme-light"
            kind="css"
            heading=${msg('Theme override (light)')}
          ></customization-slot-card>
          <customization-slot-card
            slot="theme-dark"
            kind="css"
            heading=${msg('Theme override (dark)')}
          ></customization-slot-card>
        </div>
        <h2>${msg('Branding')}</h2>
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
      margin: 0 0 24px;
      font-size: 14px;
      color: var(--theme-color-text-muted);
    }
    h2 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 600;
      color: var(--theme-color-text-secondary);
    }
    h2:not(:first-of-type) {
      margin-top: 28px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 480px), 1fr));
      gap: 16px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'customization-page': CustomizationPage;
  }
}
