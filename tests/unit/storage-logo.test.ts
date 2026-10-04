import { describe, expect, it } from 'vitest';
import { detectImageFormat, extensionFor, IMAGE_CONTENT_TYPES } from '@/lib/storage/image-signature';
import { isStoredFileName } from '@/lib/storage/uploads';

/**
 * A real one-pixel PNG and a real JPEG header, copied from the smallest files a
 * browser produces. Anything shorter than a full header would let a truncated
 * file through, so the fixtures carry the bytes the check actually reads.
 */
const PNG = Uint8Array.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const JPEG = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);
const WEBP = Uint8Array.from([
  0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x20,
]);

/** `PK\x03\x04` - what a .docx or .xlsx really is, and what a .png is not. */
const ZIP = Uint8Array.from([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x00, 0x00, 0x08, 0x00]);

describe('detectImageFormat', () => {
  it('recognises the three accepted formats from their bytes', () => {
    expect(detectImageFormat(PNG)).toBe('png');
    expect(detectImageFormat(JPEG)).toBe('jpeg');
    expect(detectImageFormat(WEBP)).toBe('webp');
  });

  it('ignores the name and the declared content type entirely', () => {
    // The same decision for the same bytes: this function has no access to a
    // filename, which is the whole point of it.
    expect(detectImageFormat(ZIP)).toBeNull();
    expect(detectImageFormat(Uint8Array.from('GIF89a....'))).toBeNull();
    expect(detectImageFormat(Uint8Array.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
  });

  it('refuses a truncated or forged header', () => {
    // Half a PNG signature: a file cut short must not be accepted as an image
    // the browser will then fail to draw.
    expect(detectImageFormat(PNG.slice(0, 4))).toBeNull();
    // SOI with nothing after it.
    expect(detectImageFormat(Uint8Array.from([0xff, 0xd8, 0xff]))).toBeNull();
    // A RIFF container that is not a WebP - the tag has to be at offset 8.
    expect(detectImageFormat(Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45]))).toBeNull();
    expect(detectImageFormat(new Uint8Array(0))).toBeNull();
  });

  it('maps each format to a content type and a truthful extension', () => {
    expect(IMAGE_CONTENT_TYPES).toEqual({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' });
    expect(extensionFor('jpeg')).toBe('jpg');
    expect(extensionFor('png')).toBe('png');
    expect(extensionFor('webp')).toBe('webp');
  });
});

describe('isStoredFileName', () => {
  it('accepts only a UUID and one of our extensions', () => {
    expect(isStoredFileName('3f2a1b6c-9d4e-4a71-8f10-2c5b7e9d0a11.png')).toBe(true);
    expect(isStoredFileName('3f2a1b6c-9d4e-4a71-8f10-2c5b7e9d0a11.jpg')).toBe(true);
    expect(isStoredFileName('3f2a1b6c-9d4e-4a71-8f10-2c5b7e9d0a11.webp')).toBe(true);
  });

  it('refuses anything that could walk out of the uploads folder', () => {
    // This function is what turns a database value into a filesystem path, so
    // traversal has to die here rather than at `path.join`.
    expect(isStoredFileName('../../etc/passwd')).toBe(false);
    expect(isStoredFileName('..%2F..%2Fetc%2Fpasswd')).toBe(false);
    expect(isStoredFileName('/etc/passwd')).toBe(false);
    expect(isStoredFileName('logo.png')).toBe(false);
    expect(isStoredFileName('3f2a1b6c-9d4e-4a71-8f10-2c5b7e9d0a11.svg')).toBe(false);
    expect(isStoredFileName('3f2a1b6c-9d4e-4a71-8f10-2c5b7e9d0a11.php')).toBe(false);
    expect(isStoredFileName('')).toBe(false);
  });
});