// Shimmering loading placeholder.

import { LitElement, css, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('ui-skeleton')
export class UiSkeleton extends LitElement {
  @property() width = '100%';
  @property() height = '16px';
  /** Number of stacked lines. */
  @property({ type: Number }) lines = 1;

  render() {
    return html`${Array.from(
      { length: this.lines },
      (_, i) =>
        html`<div
          class="bar"
          style="width:${this.lines > 1 && i === this.lines - 1 ? '60%' : this.width};height:${this.height}"
        ></div>`
    )}`;
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .bar {
      border-radius: var(--theme-radius-sm);
      background: linear-gradient(
        90deg,
        var(--theme-color-surface-sunken) 25%,
        var(--theme-color-surface-hover) 50%,
        var(--theme-color-surface-sunken) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.4s linear infinite;
    }
    @keyframes shimmer {
      to {
        background-position: -200% 0;
      }
    }
    @media (prefers-reduced-motion: reduce) {
      .bar {
        animation: none;
      }
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'ui-skeleton': UiSkeleton;
  }
}
