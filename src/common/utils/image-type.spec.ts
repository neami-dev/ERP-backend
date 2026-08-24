import { detectImageType } from './image-type';

describe('detectImageType', () => {
  it('recognises a PNG by its signature', () => {
    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00,
    ]);

    expect(detectImageType(png)).toBe('image/png');
  });

  it('recognises a JPEG by its signature', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

    expect(detectImageType(jpeg)).toBe('image/jpeg');
  });

  it('recognises a WebP by its RIFF/WEBP framing', () => {
    // RIFF <4-byte size, contents irrelevant here> WEBP
    const webp = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]);

    expect(detectImageType(webp)).toBe('image/webp');
  });

  it('returns null for a RIFF container that is not WebP', () => {
    // Same RIFF opening as a WAV file — must not be mistaken for an image.
    const wav = Buffer.from([
      0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45,
    ]);

    expect(detectImageType(wav)).toBeNull();
  });

  it('returns null rather than throwing on a truncated buffer', () => {
    expect(detectImageType(Buffer.from([0x89, 0x50]))).toBeNull();
    expect(detectImageType(Buffer.alloc(0))).toBeNull();
  });

  it('returns null for SVG bytes claiming to be an image', () => {
    // The exact case this exists to catch: XML that could carry a <script>,
    // sent with a content type that looks harmless.
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );

    expect(detectImageType(svg)).toBeNull();
  });

  it('returns null for plain garbage', () => {
    expect(detectImageType(Buffer.from('not an image'))).toBeNull();
  });
});
