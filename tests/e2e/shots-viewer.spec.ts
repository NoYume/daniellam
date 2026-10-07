import { expect, test, type Page } from '@playwright/test';
import { captionText } from '../../src/lib/shots';
import { TRIPS, type ShotTrip } from './shots-data';

// The trips come from shots.yaml, so the tests follow whatever trips are there.
const many = TRIPS.find((t) => t.photos.length >= 3);
const single = TRIPS.find((t) => t.photos.length === 1);

/** A trip's photo links. An attribute selector, since an id may start with a digit, and `#2025-x` isn't valid CSS. */
const tripLinks = (page: Page, trip: ShotTrip) => page.locator(`article[id="${trip.id}"] a.ph-link`);

/** The counter under the viewer's photo, for photo k of a trip. */
const counter = (trip: ShotTrip, k: number) => `${trip.name}, ${k + 1} of ${trip.photos.length}`;

/** Waits until the viewer is open. */
const isOpen = (page: Page) => expect(page.locator('#viewer[open]')).toBeVisible();

/** Opens the Shots page and clicks photo k of a trip. */
async function open(page: Page, trip: ShotTrip, k: number): Promise<void> {
  await page.goto('/shots/');
  await tripLinks(page, trip).nth(k).click();
  await isOpen(page);
}

/** Waits until the viewer's photo has loaded. */
const loaded = (page: Page) =>
  expect.poll(() => page.locator('#viewer .v-photo img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);

test('a click on a grid photo opens it in the viewer', async ({ page }) => {
  test.skip(!many, 'needs a trip of 3 or more photos');
  const trip = many!;
  await open(page, trip, 1);
  const viewer = page.locator('#viewer');
  await expect(viewer.locator('.v-count')).toHaveText(counter(trip, 1));
  await expect(viewer.locator('.v-cap')).toHaveText(captionText(trip.photos[1]!) ?? '');
  const img = viewer.locator('.v-photo img');
  await expect(img).toHaveAttribute('alt', trip.photos[1]!.alt);
  await expect(img).toHaveAttribute('sizes', '100vw');
  await expect(page).toHaveURL(/\/shots\/$/);
  await expect(viewer.locator('.v-close')).toBeFocused();
});

test('the arrow keys step through the trip and wrap at both ends', async ({ page }) => {
  test.skip(!many, 'needs a trip of 3 or more photos');
  const trip = many!;
  const n = trip.photos.length;
  await open(page, trip, 1);
  const count = page.locator('#viewer .v-count');
  const img = page.locator('#viewer .v-photo img');
  // From photo 2 on to the last.
  for (let k = 2; k < n; k++) {
    await page.keyboard.press('ArrowRight');
    await expect(count).toHaveText(counter(trip, k));
    await expect(img).toHaveAttribute('alt', trip.photos[k]!.alt);
  }
  await page.keyboard.press('ArrowRight');
  await expect(count).toHaveText(counter(trip, 0));
  await expect(img).toHaveAttribute('alt', trip.photos[0]!.alt);
  await page.keyboard.press('ArrowLeft');
  await expect(count).toHaveText(counter(trip, n - 1));
  await expect(img).toHaveAttribute('alt', trip.photos[n - 1]!.alt);
});

test('previous and next step, and close closes', async ({ page }) => {
  test.skip(!many, 'needs a trip of 3 or more photos');
  const trip = many!;
  await open(page, trip, 1);
  const viewer = page.locator('#viewer');
  const count = viewer.locator('.v-count');
  await viewer.locator('.v-next').click();
  await expect(count).toHaveText(counter(trip, 2));
  await viewer.locator('.v-prev').click();
  await expect(count).toHaveText(counter(trip, 1));
  await viewer.locator('.v-close').click();
  await expect(viewer).not.toHaveAttribute('open');
});

test('Esc closes, and focus returns to the photo', async ({ page }) => {
  test.skip(!many, 'needs a trip of 3 or more photos');
  const trip = many!;
  await open(page, trip, 1);
  await page.keyboard.press('Escape');
  await expect(page.locator('#viewer')).not.toHaveAttribute('open');
  await expect(tripLinks(page, trip).nth(1)).toBeFocused();
});

test('a click outside the photo closes it', async ({ page }) => {
  test.skip(!many, 'needs a trip of 3 or more photos');
  await open(page, many!, 1);
  await page.mouse.click(8, 8);
  await expect(page.locator('#viewer')).not.toHaveAttribute('open');
});

/** 8px in from the first cover's left edge, at its middle: on the cover in the page, and on the viewer's margin once that's open. */
async function coverEdge(page: Page): Promise<{ x: number; y: number }> {
  const cover = page.locator('figure.cover a.ph-link').first();
  await cover.scrollIntoViewIfNeeded();
  const box = (await cover.boundingBox())!;
  return { x: box.x + 8, y: box.y + box.height / 2 };
}

test('a double-click on a photo opens it and leaves it open', async ({ page }) => {
  await page.goto('/shots/');
  const viewer = page.locator('#viewer');
  // The second click of a double-click lands on the viewer the first one opened. Soft, so the real double-click below runs either way.
  await page.locator('a.ph-link').first().click();
  await isOpen(page);
  await viewer.dispatchEvent('click', { detail: 2 });
  await expect.soft(viewer, 'a second click on the viewer').toHaveAttribute('open', '');
  // A real one at the cover's edge: its second click lands on the viewer's margin, beside the photo.
  await page.keyboard.press('Escape');
  const at = await coverEdge(page);
  await page.mouse.dblclick(at.x, at.y);
  await expect(viewer, 'a double-click at the edge of a cover').toHaveAttribute('open', '');
});

test("a double-click that closes the viewer doesn't open it again", async ({ page }) => {
  await page.goto('/shots/');
  const viewer = page.locator('#viewer');
  const link = page.locator('a.ph-link').first();
  // Once the first click has closed the viewer, the second lands on a photo: it neither opens it nor follows the link.
  await link.click();
  await isOpen(page);
  await page.keyboard.press('Escape');
  await link.dispatchEvent('click', { detail: 2 });
  await expect.soft(viewer, 'a second click on a photo').not.toHaveAttribute('open');
  await page.keyboard.press('Escape');
  // A real one on the viewer's margin, over the cover's edge.
  const at = await coverEdge(page);
  await link.click();
  await isOpen(page);
  await page.mouse.dblclick(at.x, at.y);
  await expect(viewer, 'a double-click on the margin').not.toHaveAttribute('open');
  await expect(page).toHaveURL(/\/shots\/$/);
});

test('a trip of one photo has no previous or next', async ({ page }) => {
  test.skip(!single, 'needs a trip of one photo');
  const trip = single!;
  await open(page, trip, 0);
  const viewer = page.locator('#viewer');
  await expect(viewer.locator('.v-prev')).toBeHidden();
  await expect(viewer.locator('.v-next')).toBeHidden();
  await expect(viewer.locator('.v-count')).toHaveText(`${trip.name}, 1 of 1`);
});

test('Enter on a focused photo opens it', async ({ page }) => {
  test.skip(!many, 'needs a trip of 3 or more photos');
  const trip = many!;
  await page.goto('/shots/');
  await tripLinks(page, trip).nth(1).focus();
  await page.keyboard.press('Enter');
  await isOpen(page);
  await expect(page.locator('#viewer .v-count')).toHaveText(counter(trip, 1));
});

test('the page underneath keeps its place', async ({ page, isMobile }) => {
  test.skip(isMobile, 'scrolls with a mouse wheel');
  test.skip(!TRIPS.some((t) => t.photos.length > 1), 'needs a grid photo');
  await page.goto('/shots/');
  const card = page.locator('figure.card a.ph-link').first();
  await card.scrollIntoViewIfNeeded();
  const y = await page.evaluate(() => scrollY);
  await card.click();
  await isOpen(page);
  await page.mouse.wheel(0, 800);
  // The wheel doesn't wait for the scroll it starts, so give one the time to happen.
  await page.waitForTimeout(500);
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await page.keyboard.press('Escape');
  await expect(page.locator('#viewer')).not.toHaveAttribute('open');
  expect(await page.evaluate(() => scrollY)).toBe(y);
  await expect(page.locator('html')).toHaveCSS('overflow-y', 'visible');
});

test('a scroll still running stops when the viewer opens', async ({ page }) => {
  await page.goto('/shots/');
  // Focus scrolls the page smoothly to the last photo (base.css), and Enter opens it before that ends.
  const link = page.locator('a.ph-link').last();
  await link.focus();
  await page.keyboard.press('Enter');
  await isOpen(page);
  const y = await page.evaluate(() => scrollY);
  await page.waitForTimeout(1000);
  // Room for a frame of the stopped scroll on a slow machine; one left running moves the page thousands of px.
  expect(Math.abs((await page.evaluate(() => scrollY)) - y)).toBeLessThanOrEqual(60);
  await page.keyboard.press('Escape');
  await expect(link).toBeFocused();
  await expect(link).toBeInViewport();
});

test("a portrait photo fits the viewer's height", async ({ page }) => {
  await page.goto('/shots/');
  const index = await page.locator('figure.photo img').evaluateAll((imgs) => imgs.findIndex((img) => Number(img.getAttribute('height')) > Number(img.getAttribute('width'))));
  test.skip(index < 0, 'needs a portrait photo');
  await page.locator('figure.photo a.ph-link').nth(index).click();
  await isOpen(page);
  await loaded(page);
  const m = await page.locator('#viewer .v-photo img').evaluate((img) => ({ box: img.getBoundingClientRect().toJSON() as DOMRect, innerWidth, innerHeight }));
  expect(m.box.height).toBeLessThanOrEqual(m.innerHeight - 150 + 1);
  expect(m.box.width).toBeLessThanOrEqual(m.innerWidth);
});

test('on a short phone the caption clears previous and next', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the phone layout');
  for (const [width, height] of [[393, 659], [375, 548]] as const) {
    await page.setViewportSize({ width, height });
    await page.goto('/shots/');
    const index = await page.locator('figure.photo img').evaluateAll((imgs) => imgs.findIndex((img) => Number(img.getAttribute('height')) > Number(img.getAttribute('width'))));
    test.skip(index < 0, 'needs a portrait photo');
    await page.locator('figure.photo a.ph-link').nth(index).click();
    await isOpen(page);
    await loaded(page);
    const m = await page.locator('#viewer').evaluate((dialog) => ({
      captionBottom: dialog.querySelector('figcaption')!.getBoundingClientRect().bottom,
      buttonsTop: dialog.querySelector('.v-prev')!.getBoundingClientRect().top,
      scrollHeight: dialog.scrollHeight,
      clientHeight: dialog.clientHeight,
    }));
    // Soft, so every size reports.
    const at = `${width} x ${height}`;
    expect.soft(m.captionBottom, `${at}: the caption ends above previous and next`).toBeLessThanOrEqual(m.buttonsTop);
    expect.soft(m.scrollHeight, `${at}: the viewer doesn't scroll`).toBeLessThanOrEqual(m.clientHeight);
  }
});

test('the viewer picks a larger file from the same set', async ({ page }) => {
  await page.goto('/shots/');
  const index = await page.locator('figure.card img').evaluateAll((imgs) => imgs.findIndex((img) => Number(img.getAttribute('width')) > Number(img.getAttribute('height'))));
  test.skip(index < 0, 'needs a landscape grid photo');
  await page.locator('figure.card a.ph-link').nth(index).click();
  await isOpen(page);
  await loaded(page);
  // naturalWidth is density-corrected: for a srcset of widths it reports the `sizes` width,
  // whichever file was picked. A fresh image of the picked file reports the file's own width.
  const m = await page.locator('#viewer .v-photo img').evaluate(async (img: HTMLImageElement) => {
    const file = new Image();
    file.src = img.currentSrc;
    await file.decode();
    return { fileWidth: file.naturalWidth, need: Math.min(innerWidth * devicePixelRatio, Number(img.getAttribute('width'))) };
  });
  expect(m.fileWidth).toBeGreaterThanOrEqual(m.need);
});

test('a swipe steps on touch screens', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'touch screens');
  test.skip(!many, 'needs a trip of 3 or more photos');
  const trip = many!;
  await open(page, trip, 1);
  const photo = page.locator('#viewer .v-photo');
  const count = page.locator('#viewer .v-count');
  await photo.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: 300, clientY: 400 });
  await photo.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, clientX: 220, clientY: 410 });
  await expect(count).toHaveText(counter(trip, 2));
  // Further down than sideways: no step.
  await photo.dispatchEvent('pointerdown', { pointerType: 'touch', isPrimary: true, clientX: 300, clientY: 400 });
  await photo.dispatchEvent('pointerup', { pointerType: 'touch', isPrimary: true, clientX: 280, clientY: 520 });
  await expect(count).toHaveText(counter(trip, 2));
});
