import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { localizationService } from '../services/localization.service';
import type { LocaleCode } from '../types/localization.types';

export class LocaleController implements ReactiveController {
  private host: ReactiveControllerHost;
  private _handleLocaleChange = (): void => {
    this.host.requestUpdate();
  };

  constructor(host: ReactiveControllerHost) {
    this.host = host;
    host.addController(this);
  }

  hostConnected(): void {
    window.addEventListener('lit-localize-status', this._handleLocaleChange);
  }

  hostDisconnected(): void {
    window.removeEventListener('lit-localize-status', this._handleLocaleChange);
  }

  get locale(): LocaleCode {
    return localizationService.getLocale();
  }
}

/**
 * Decorator for TypeScript classes
 * Triggers re-render when locale changes
 */
export function localized() {
  return function <T extends { new (...args: any[]): HTMLElement }>(
    constructor: T
  ): T {
    const connectedCallback = constructor.prototype.connectedCallback;

    constructor.prototype.connectedCallback = function () {
      new LocaleController(this);
      if (connectedCallback) {
        connectedCallback.call(this);
      }
    };

    return constructor;
  };
}
