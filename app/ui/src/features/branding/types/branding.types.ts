// Branding API contract — mirrors the backend manifest DTO.

export type BrandingSlot =
  | 'logo-light'
  | 'logo-dark'
  | 'favicon-light'
  | 'favicon-dark';

export interface BrandingSlotEntry {
  present: boolean;
  content_type: string | null;
  updated_at: number | null;
}

export interface BrandingManifest {
  /** Max mtime across slots (unix seconds, '0' when empty) — cache-buster. */
  version: string;
  slots: Record<BrandingSlot, BrandingSlotEntry>;
}

export const BRANDING_SLOTS: BrandingSlot[] = [
  'logo-light',
  'logo-dark',
  'favicon-light',
  'favicon-dark',
];
