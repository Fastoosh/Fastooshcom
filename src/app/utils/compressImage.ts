// Shrinks an image in the browser before it is uploaded: scales it down to fit
// `maxSize` px and re-encodes it as WebP. Quality 0.85 is visually close to the
// original for screenshots and photos, usually at a fraction of the size.
// Returns the original file when compressing wouldn't help (GIF/SVG, already
// smaller, or the browser can't encode WebP).

export interface CompressResult {
  file: File;
  before: number;   // bytes
  after: number;    // bytes
  compressed: boolean;
}

export async function compressImage(
  file: File,
  { maxSize = 2400, quality = 0.85 }: { maxSize?: number; quality?: number } = {},
): Promise<CompressResult> {
  const keep = { file, before: file.size, after: file.size, compressed: false };
  // GIFs may be animated and SVGs are already tiny vectors — leave them alone.
  if (!/^image\/(png|jpe?g|webp|bmp)$/i.test(file.type)) return keep;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return keep;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close?.();
    const blob: Blob | null = await new Promise(res => canvas.toBlob(res, 'image/webp', quality));
    // Some browsers fall back to PNG when WebP encoding isn't supported.
    if (!blob || blob.type !== 'image/webp' || blob.size >= file.size) return keep;
    const name = file.name.replace(/\.[^.]+$/, '') + '.webp';
    return { file: new File([blob], name, { type: 'image/webp' }), before: file.size, after: blob.size, compressed: true };
  } catch {
    return keep;
  }
}

export const formatBytes = (n: number) =>
  n >= 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
