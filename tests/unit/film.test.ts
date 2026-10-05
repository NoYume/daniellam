import { expect, test } from 'bun:test';
import { blueHourWash, centerCrop169, glowMask, grade, matchHaze, screen, type Raw } from '../../scripts/lib/film';
import type { HazeName } from '../../src/lib/haze';

type RGB = [number, number, number];

/** A w×h image filled with one color. */
function px(r: number, g: number, b: number, w = 4, h = 4): Raw {
  const data = new Uint8Array(w * h * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return { data, width: w, height: h, channels: 3 };
}

/** Paints rows from (inclusive) to (exclusive) with one color. */
function paintRows(img: Raw, from: number, to: number, [r, g, b]: RGB): Raw {
  for (let y = from; y < to; y++) {
    for (let x = 0; x < img.width; x++) {
      const i = (y * img.width + x) * 3;
      img.data[i] = r;
      img.data[i + 1] = g;
      img.data[i + 2] = b;
    }
  }
  return img;
}

function pixel(img: Raw, x: number, y: number): RGB {
  const i = (y * img.width + x) * 3;
  return [img.data[i], img.data[i + 1], img.data[i + 2]];
}

/** Every pixel is within ±1 of the expected color. */
function near(img: Raw, want: RGB) {
  let worst = 0;
  for (let i = 0; i < img.data.length; i += 3) {
    for (let c = 0; c < 3; c++) worst = Math.max(worst, Math.abs(img.data[i + c] - want[c]));
  }
  expect(worst, `first pixel ${pixel(img, 0, 0)} vs ${want}`).toBeLessThanOrEqual(1);
}

// Expected values come from the prototype's formulas (spec 7.1), worked by hand and rounded.
test('blue hour grade', () => {
  near(grade(px(0, 0, 0), 'bluehour'), [15, 21, 32]);
  near(grade(px(255, 255, 255), 'bluehour'), [229, 234, 246]);
  near(grade(px(128, 128, 128), 'bluehour'), [113, 115, 122]);
});

test('smart casual grade', () => {
  near(grade(px(0, 0, 0), 'casual'), [44, 49, 56]);
  near(grade(px(255, 255, 255), 'casual'), [241, 239, 236]);
  near(grade(px(200, 120, 60), 'casual'), [188, 140, 105]);
});

test('grade leaves its input untouched', () => {
  const img = px(200, 120, 60);
  grade(img, 'casual');
  expect(pixel(img, 0, 0)).toEqual([200, 120, 60]);
});

test.each([
  [[100, 150, 200], 'ice'],
  [[40, 60, 90], 'denim'],
  [[20, 30, 60], 'navy'],
  [[200, 150, 100], 'dusk'],
  [[128, 128, 128], 'silver'],
] as [RGB, HazeName][])('uniform %p picks %s', (c, h) => {
  expect(matchHaze(px(c[0], c[1], c[2], 160, 90)).haze).toBe(h);
});

// A bright blue counts heavily under the L² weighting, so reading these rows would flip the pick to a blue.
const BRIGHT_BLUE: RGB = [100, 150, 255];

test('haze ignores rows above the fog band', () => {
  // 160×90 is already 16:9; the band starts at row floor(.25 × 90) = 22.
  const img = paintRows(px(128, 128, 128, 160, 90), 0, 20, BRIGHT_BLUE);
  expect(matchHaze(img).haze).toBe('silver');
});

test('haze reads the 16:9 center of a portrait photo', () => {
  // The 16:9 crop of 90×160 is rows 55-105; an uncropped read would start at row 40.
  const img = paintRows(px(128, 128, 128, 90, 160), 0, 55, BRIGHT_BLUE);
  expect(matchHaze(img).haze).toBe('silver');
});

test('center crop', () => {
  expect(centerCrop169(2560, 1440)).toEqual({ left: 0, top: 0, width: 2560, height: 1440 });
  expect(centerCrop169(1000, 1000)).toEqual({ left: 0, top: 219, width: 1000, height: 563 });
  expect(centerCrop169(4000, 1000)).toEqual({ left: 1111, top: 0, width: 1778, height: 1000 });
});

test('glow mask keeps only the brightest pixels', () => {
  const img = paintRows(px(50, 50, 50, 100, 100), 99, 100, [255, 255, 255]);
  const { mask } = glowMask(img);
  expect(pixel(mask, 0, 0)).toEqual([0, 0, 0]);
  expect(pixel(mask, 50, 50)).toEqual([0, 0, 0]);
  expect(pixel(mask, 10, 99)).toEqual([255, 255, 255]);
});

test('blue hour wash multiplies by the cool tint', () => {
  near(blueHourWash(px(255, 255, 255)), [205, 218, 240]);
  near(blueHourWash(px(128, 128, 128)), [103, 109, 120]);
});

test('screen lightens like two stacked projections', () => {
  near(screen(px(128, 0, 255), px(128, 128, 128)), [192, 128, 255]);
});
