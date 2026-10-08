// Customization API contract — mirrors the backend manifest DTO.

export type CustomizationSlot =
  | 'logo-light'
  | 'logo-dark'
  | 'favicon-light'
  | 'favicon-dark';

export interface CustomizationSlotEntry {
  present: boolean;
  content_type: string | null;
  updated_at: number | null;
}

export interface CustomizationManifest {
  /** Max mtime across slots (unix seconds, '0' when empty) — cache-buster. */
  version: string;
  slots: Record<CustomizationSlot, CustomizationSlotEntry>;
}

export const CUSTOMIZATION_SLOTS: CustomizationSlot[] = [
  'logo-light',
  'logo-dark',
  'favicon-light',
  'favicon-dark',
];
