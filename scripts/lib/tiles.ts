// The two textures the hero layers in the browser: the fog the haze color
// shows through, and the film grain. Fixed seeds keep them the same every build.
// Both load before the first paint, so they ship as small WebP files: the grain
// lossy (it keeps its spread: 128 ± 18.4 against 18.5 as PNG, at a quarter of
// the bytes), the fog at half size with lossless alpha.
import sharp from 'sharp';
import { mulberry32 } from './random';

/**
 * 200×113 WebP: soft white ellipses on transparent, v6's 400×225 fog at half
 * size (the hero stretches it to 1600px wide either way). It repeats sideways
 * without a seam. Its alpha is lossless: lossy alpha keeps about 16 levels,
 * which show as contour bands once stretched.
 */
export async function fogTile(): Promise<Buffer> {
  const W = 400, H = 225, r = mulberry32(19);
  const shapes: string[] = [];
  for (let i = 0; i < 70; i++) {
    const x = r() * W, y = H * (0.3 + r() * 0.5), rx = 30 + r() * 90, ry = 8 + r() * 18, a = 0.05 + r() * 0.12;
    // Each ellipse goes in three tiles side by side, and the middle one is kept.
    // The renderer cuts shapes off at the canvas edge before it blurs, which
    // faded both edges of a lone tile; here the blur runs across them.
    for (const cx of [x, x + W, x + 2 * W]) {
      shapes.push(`<ellipse cx="${cx.toFixed(2)}" cy="${y.toFixed(2)}" rx="${rx.toFixed(2)}" ry="${ry.toFixed(2)}" fill-opacity="${a.toFixed(3)}"/>`);
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${3 * W}" height="${H}">
<filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="18"/></filter>
<g fill="#fff" filter="url(#b)">${shapes.join('')}</g></svg>`;
  return sharp(Buffer.from(svg))
    .extract({ left: W, top: 0, width: W, height: H })
    .resize(W / 2, Math.round(H / 2), { fit: 'fill' })
    .webp({ quality: 70, alphaQuality: 100 })
    .toBuffer();
}

/** 256×256 grayscale noise around mid-gray, for an overlay blend. */
export async function grainTile(): Promise<Buffer> {
  const N = 256, r = mulberry32(7);
  const data = Buffer.alloc(N * N);
  for (let i = 0; i < data.length; i++) data[i] = Math.round(128 + (r() - 0.5) * 64);
  return sharp(data, { raw: { width: N, height: N, channels: 1 } }).webp({ quality: 70 }).toBuffer();
}
