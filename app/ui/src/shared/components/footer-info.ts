import { LitElement, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';
import { footerInfoStyles } from './footer-info.styles';

@customElement('footer-info')
@localized()
export class FooterInfo extends LitElement {
  render() {
    return html`
      <footer>
        <div class="left">
          <span class="status">
            <span class="status-dot"></span>
            ${msg('Operational')}
          </span>
          <span class="separator">•</span>
          <span class="version">${msg('v0.0.0')}</span>
        </div>
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
