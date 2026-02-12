import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { msg } from '@lit/localize';
import { localized } from '@/features/localization';

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

  static styles = css`
    :host {
      display: block;
      width: 100%;
    }

    footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 1.5rem 2rem;
      color: var(--theme-color-text-secondary);
      font-size: 0.875rem;
      max-width: 1400px;
      margin: 0 auto;
      transition: color 0.2s ease;
    }

    .left,
    .right {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      flex-wrap: wrap;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.375rem;
      font-weight: 500;
      color: var(--theme-color-text-secondary);
      transition: color 0.2s ease;
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: var(--theme-color-success);
      border-radius: 50%;
    }

    .version {
      color: var(--theme-color-text-muted);
      transition: color 0.2s ease;
    }

    .separator {
      color: var(--theme-color-border);
      transition: color 0.2s ease;
    }

    a {
      color: var(--theme-color-text-secondary);
      text-decoration: none;
      transition: color 0.2s ease;
    }

    a:hover {
      color: var(--theme-color-primary);
    }

    @media (max-width: 768px) {
      footer {
        flex-direction: column;
        gap: 0.75rem;
        padding: 1.5rem 1rem;
      }

      .left,
      .right {
        justify-content: center;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'footer-info': FooterInfo;
  }
}
