// BrandingService — singleton; fetches the branding manifest once during
// app init and exposes per-slot override URLs (with a cache-busting
// ?v=) or null when the bundled default applies. Mutations refresh the
// manifest and dispatch 'branding-changed' so consumers re-render.

import { apiFetch } from '@/shared/services/http-client';
import {
  type BrandingManifest,
  type BrandingSlot,
  type BrandingSlotEntry,
} from '../types/branding.types';

export class BrandingService {
  private static instance: BrandingService | null = null;

  private initPromise: Promise<void> | null = null;
  private manifest: BrandingManifest | null = null;

  static getInstance(): BrandingService {
    if (!BrandingService.instance) {
      BrandingService.instance = new BrandingService();
    }
    return BrandingService.instance;
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
    this.manifest = await apiFetch<BrandingManifest>('/api/branding');
    window.dispatchEvent(
      new CustomEvent('branding-changed', { bubbles: true, composed: true })
    );
  }

  /** Override URL for a slot, or null when the default asset applies. */
  overrideUrl(slot: BrandingSlot): string | null {
    if (!this.manifest?.slots[slot]?.present) return null;
    return `/branding/${slot}?v=${this.manifest.version}`;
  }

  entry(slot: BrandingSlot): BrandingSlotEntry | null {
    return this.manifest?.slots[slot] ?? null;
  }

  version(): string {
    return this.manifest?.version ?? '0';
  }

  async upload(slot: BrandingSlot, file: File): Promise<void> {
    const body = new FormData();
    body.append('file', file);
    await apiFetch(`/api/branding/${slot}`, { method: 'PUT', body });
    await this.refresh();
  }

  async remove(slot: BrandingSlot): Promise<void> {
    await apiFetch(`/api/branding/${slot}`, { method: 'DELETE' });
    await this.refresh();
  }
}

export const brandingService = BrandingService.getInstance();
