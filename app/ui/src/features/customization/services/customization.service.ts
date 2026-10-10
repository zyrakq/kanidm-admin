// CustomizationService — singleton; fetches the customization manifest
// once during app init and exposes per-slot override URLs (with a
// cache-busting ?v=) or null when the bundled default applies. Theme
// variants are read from the manifest's theme section and mutated via
// select/upload/remove. Mutations refresh the manifest and dispatch
// 'customization-changed' so consumers re-render.

import { apiFetch } from '@/shared/services/http-client';
import {
  type CustomizationManifest,
  type CustomizationSlot,
  type CustomizationSlotEntry,
  type ThemeManifest,
  type ThemeMode,
} from '../types/customization.types';

export class CustomizationService {
  private static instance: CustomizationService | null = null;

  private initPromise: Promise<void> | null = null;
  private manifest: CustomizationManifest | null = null;

  static getInstance(): CustomizationService {
    if (!CustomizationService.instance) {
      CustomizationService.instance = new CustomizationService();
    }
    return CustomizationService.instance;
  }

  private constructor() {}

  /** Fetch the manifest once; concurrent callers share the promise. */
  async init(): Promise<void> {
    if (this.initPromise) return this.initPromise;
    this.initPromise = this.refresh().catch(() => {
      // Manifest fetch failure keeps bundled defaults; retry on next init.
      this.initPromise = null;
    });
    return this.initPromise;
  }

  async refresh(): Promise<void> {
    this.manifest = await apiFetch<CustomizationManifest>('/api/customization');
    window.dispatchEvent(
      new CustomEvent('customization-changed', {
        bubbles: true,
        composed: true,
      })
    );
  }

  /** Override URL for a slot, or null when the default asset applies. */
  overrideUrl(slot: CustomizationSlot): string | null {
    if (!this.manifest?.slots[slot]?.present) return null;
    return `/customization/${slot}?v=${this.manifest.version}`;
  }

  entry(slot: CustomizationSlot): CustomizationSlotEntry | null {
    return this.manifest?.slots[slot] ?? null;
  }

  /** Theme section of the manifest, or null before init succeeds. */
  theme(): ThemeManifest | null {
    return this.manifest?.theme ?? null;
  }

  version(): string {
    return this.manifest?.version ?? '0';
  }

  async upload(slot: CustomizationSlot, file: File): Promise<void> {
    const body = new FormData();
    body.append('file', file);
    await apiFetch(`/api/customization/${slot}`, { method: 'PUT', body });
    await this.refresh();
  }

  async remove(slot: CustomizationSlot): Promise<void> {
    await apiFetch(`/api/customization/${slot}`, { method: 'DELETE' });
    await this.refresh();
  }

  /** Set (name) or clear (null) the stored selection for one mode. */
  async selectTheme(mode: ThemeMode, name: string | null): Promise<void> {
    await apiFetch(`/api/customization/theme/${mode}`, {
      method: 'PUT',
      body: JSON.stringify({ name }),
    });
    await this.refresh();
  }

  /** Upload a theme variant; returns the stored (sanitized) name. */
  async uploadThemeVariant(file: File): Promise<string> {
    const body = new FormData();
    body.append('file', file);
    const res = await apiFetch<{ name: string }>('/api/customization/themes', {
      method: 'POST',
      body,
    });
    await this.refresh();
    return res.name;
  }

  async removeThemeVariant(name: string): Promise<void> {
    await apiFetch(`/api/customization/themes/${encodeURIComponent(name)}`, {
      method: 'DELETE',
    });
    await this.refresh();
  }
}

export const customizationService = CustomizationService.getInstance();
