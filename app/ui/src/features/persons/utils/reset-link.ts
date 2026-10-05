// app/ui/src/features/persons/utils/reset-link.ts
//
// Credential-reset link helpers: the full URL for an intent token and
// its QR code rendering. The Kanidm base URL comes from /api/status
// (the backend resolves it, including container-mode rewrites) because
// the proxy does not forward generic /ui/* pages — reset links must
// point at the Kanidm server origin directly.

import qrcode from 'qrcode-generator';

/** Error correction level 'M' — a good balance for on-screen codes. */
const QR_ERROR_CORRECTION = 'M';

/** QR cell size in SVG pixels; the <img> scales the code down anyway. */
const QR_CELL_SIZE = 4;

/** Quiet-zone margin around the code, in SVG pixels. */
const QR_MARGIN = 2;

/**
 * Full reset link for an intent token: the Kanidm server origin plus
 * its reset page with the token as a query parameter.
 */
export function buildResetUrl(kanidmUrl: string, token: string): string {
  const base = kanidmUrl.replace(/\/+$/, '');
  return `${base}/ui/reset?token=${encodeURIComponent(token)}`;
}

/**
 * QR code for the given text as a self-contained SVG data URL (no
 * canvas, no network). Black modules on a transparent background — the
 * consumer paints a white backdrop so scanners get enough contrast.
 */
export function qrDataUrl(text: string): string {
  const qr = qrcode(0, QR_ERROR_CORRECTION);
  qr.addData(text);
  qr.make();
  const svg = qr.createSvgTag({
    cellSize: QR_CELL_SIZE,
    margin: QR_MARGIN,
  });
  return `data:image/svg+xml;base64,${btoa(svg)}`;
}

/**
 * PNG blob of the QR code for the given text (clipboard image writes
 * only accept PNG). Draws the SVG onto a white canvas — QR codes must
 * stay black-on-white to scan reliably, regardless of the theme.
 */
export async function qrPngBlob(text: string): Promise<Blob> {
  const image = new Image();
  image.src = qrDataUrl(text);
  await image.decode();

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('canvas 2d context unavailable');
  }
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/png')
  );
  if (!blob) {
    throw new Error('failed to encode the QR code as PNG');
  }
  return blob;
}
