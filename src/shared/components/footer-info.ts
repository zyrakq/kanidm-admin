import { LitElement, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';

@customElement('footer-info')
export class FooterInfo extends LitElement {
  render() {
    return html`
      <footer>
        <div class="left">
          <span class="status">
            <span class="status-dot"></span>
            Operational
          </span>
          <span class="separator">•</span>
          <span class="version">v0.0.0</span>
        </div>
        <div class="right">
          <a
            href="https://github.com/zyrakq/kanidm-admin"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <span class="separator">•</span>
          <a
            href="https://kanidm.github.io/kanidm/stable/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Kanidm Docs
          </a>
          <span class="separator">•</span>
          <a
            href="https://github.com/kanidm/kanidm"
            target="_blank"
            rel="noopener noreferrer"
          >
            Kanidm GitHub
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
      color: #6b7280;
      font-size: 0.875rem;
      max-width: 1400px;
      margin: 0 auto;
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
    }

    .status-dot {
      width: 8px;
      height: 8px;
      background: #10b981;
      border-radius: 50%;
    }

    .version {
      color: #9ca3af;
    }

    .separator {
      color: #d1d5db;
    }

    a {
      color: #6b7280;
      text-decoration: none;
      transition: color 0.2s ease;
    }

    a:hover {
      color: #ff6b35;
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
