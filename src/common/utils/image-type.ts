export type SupportedImageType = 'image/png' | 'image/jpeg' | 'image/webp';

/**
 * Identifies an image by its own bytes, not by what the client claims.
 *
 * A client can label anything `image/png` — including an SVG, which is XML
 * and can carry a `<script>` tag. Serving that back with an image content
 * type from this origin would be stored XSS against whoever views it. Every
 * caller that accepts an image upload must check the buffer against this,
 * and store the result, not the claimed type.
 *
 * Returns `null` for anything unrecognised, including a truncated buffer —
 * never throws, so a caller can turn an unknown type into whatever error
 * shape it needs.
 */
export function detectImageType(buffer: Buffer): SupportedImageType | null {
  if (isPng(buffer)) return 'image/png';
  if (isJpeg(buffer)) return 'image/jpeg';
  if (isWebp(buffer)) return 'image/webp';

  return null;
}

function isPng(buffer: Buffer): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

  return matches(buffer, 0, signature);
}

function isJpeg(buffer: Buffer): boolean {
  return matches(buffer, 0, [0xff, 0xd8, 0xff]);
}

function isWebp(buffer: Buffer): boolean {
  // RIFF <4-byte size> WEBP
  return (
    matches(buffer, 0, [0x52, 0x49, 0x46, 0x46]) &&
    matches(buffer, 8, [0x57, 0x45, 0x42, 0x50])
  );
}

function matches(buffer: Buffer, offset: number, signature: number[]): boolean {
  if (buffer.length < offset + signature.length) {
    return false;
  }

  return signature.every((byte, i) => buffer[offset + i] === byte);
}
