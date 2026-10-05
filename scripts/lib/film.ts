// Film grade, photo glow and haze matching, ported from the round 6 prototype
// (`grade`, `drawBloom`, `finish` and `matchHaze`). See spec 7.1 and 7.2.
import type { HazeName } from '../../src/lib/haze';

export type Film = 'bluehour' | 'casual';

/** Packed 8-bit RGB pixels, row by row. */
export interface Raw {
  data: Uint8Array;
  width: number;
  height: number;
  channels: 3;
}

/** Relative luminance of 0-1 channel values. */
export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function clamp01(x: number): number {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}

export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0));
  return t * t * (3 - 2 * t);
}

function to255(x: number): number {
  return Math.round(clamp01(x) * 255);
}

function blank(img: Raw): Raw {
  return { data: new Uint8Array(img.data.length), width: img.width, height: img.height, channels: 3 };
}

const FILMS = {
  // Night photos: desaturate, cool shadows and highlights, lifted blacks.
  bluehour: {
    sat: 0.72,
    shadow: [16 / 255, 26 / 255, 46 / 255],
    highlight: [214 / 255, 228 / 255, 248 / 255],
    weights: (L: number) => [(1 - L) ** 2 * 0.45, smoothstep(0.6, 1, L) * 0.25],
    out: (c: number, ch: number) => (ch === 2 ? 0.05 + 0.92 * c : [0.035, 0.04][ch] + 0.9 * c),
  },
  // Day photos, light-mode values: navy shadows, milk tea highlights, paper-light lift.
  casual: {
    sat: 0.78,
    shadow: [34 / 255, 51 / 255, 77 / 255],
    highlight: [143 / 255, 134 / 255, 118 / 255],
    weights: (L: number) => [(1 - L) ** 2 * 0.32, L * L * 0.22],
    out: (c: number) => (0.13 + 0.87 * c) * 1.03,
  },
} as const;

/** Grades a photo with one film. Returns a new image; no grain is added. */
export function grade(img: Raw, film: Film): Raw {
  const f = FILMS[film];
  const out = blank(img);
  const src = img.data;
  const c = [0, 0, 0];
  for (let i = 0; i < src.length; i += 3) {
    const r = src[i] / 255, g = src[i + 1] / 255, b = src[i + 2] / 255;
    const L = luminance(r, g, b);
    const [ws, wh] = f.weights(L);
    const k = 1 - ws - wh;
    c[0] = r; c[1] = g; c[2] = b;
    for (let ch = 0; ch < 3; ch++) {
      const desat = L + (c[ch] - L) * f.sat;
      out.data[i + ch] = to255(f.out(desat * k + f.shadow[ch] * ws + f.highlight[ch] * wh, ch));
    }
  }
  return out;
}

/**
 * The glow mask, before blurring: only pixels brighter than this photo's own
 * 86th percentile glow, ramping up to its 99.5th.
 */
export function glowMask(img: Raw): { mask: Raw; lo: number; hi: number } {
  const src = img.data;
  const samples: number[] = [];
  for (let i = 0; i < src.length; i += 3 * 97) samples.push(luminance(src[i] / 255, src[i + 1] / 255, src[i + 2] / 255));
  samples.sort((a, b) => a - b);
  const lo = samples[Math.floor(samples.length * 0.86)];
  const hi = Math.max(lo + 0.08, samples[Math.floor(samples.length * 0.995)]);
  const mask = blank(img);
  for (let i = 0; i < src.length; i += 3) {
    const k = smoothstep(lo, hi, luminance(src[i] / 255, src[i + 1] / 255, src[i + 2] / 255));
    mask.data[i] = Math.round(src[i] * k);
    mask.data[i + 1] = Math.round(src[i + 1] * k);
    mask.data[i + 2] = Math.round(Math.min(255, src[i + 2] * k * 1.08));
  }
  return { mask, lo, hi };
}

const WASH = [205 / 255, 218 / 255, 240 / 255];

/** Blue Hour's cool wash: multiply by rgb(205, 218, 240). */
export function blueHourWash(img: Raw): Raw {
  const out = blank(img);
  for (let i = 0; i < img.data.length; i++) out.data[i] = Math.round(img.data[i] * WASH[i % 3]);
  return out;
}

/** Screen blend, per channel: 1 - (1 - a)(1 - b). */
export function screen(a: Raw, b: Raw): Raw {
  const out = blank(a);
  for (let i = 0; i < a.data.length; i++) out.data[i] = Math.round(255 - ((255 - a.data[i]) * (255 - b.data[i])) / 255);
  return out;
}

/** The part of a photo that a 16:9 screen shows, centered. */
export function centerCrop169(width: number, height: number): { left: number; top: number; width: number; height: number } {
  if (width / height > 16 / 9) {
    const w = (height * 16) / 9;
    return { left: Math.round((width - w) / 2), top: 0, width: Math.round(w), height };
  }
  const h = (width * 9) / 16;
  return { left: 0, top: Math.round((height - h) / 2), width, height: Math.round(h) };
}

/**
 * Picks the haze color from the light in the fog band (25-80% of the 16:9
 * crop's height). Brighter pixels count more, so a lit sign outweighs a dark wall.
 */
export function matchHaze(img: Raw): { haze: HazeName; cool: number; mean: number } {
  const crop = centerCrop169(img.width, img.height);
  const y0 = Math.floor(crop.height * 0.25), y1 = Math.floor(crop.height * 0.8);
  let r = 0, b = 0, w = 0, sum = 0, n = 0;
  for (let y = y0; y < y1; y += 5) {
    for (let x = 0; x < crop.width; x += 5) {
      const i = ((crop.top + y) * img.width + crop.left + x) * 3;
      const R = img.data[i] / 255, G = img.data[i + 1] / 255, B = img.data[i + 2] / 255;
      const L = luminance(R, G, B);
      const wt = L * L + 0.002;
      r += R * wt; b += B * wt; w += wt;
      sum += L; n++;
    }
  }
  const cool = b / w - r / w;
  const mean = sum / n;
  let haze: HazeName = 'silver';
  if (cool >= 0.03) haze = mean >= 0.3 ? 'ice' : mean >= 0.17 ? 'denim' : 'navy';
  else if (cool <= -0.035) haze = 'dusk';
  return { haze, cool, mean };
}
