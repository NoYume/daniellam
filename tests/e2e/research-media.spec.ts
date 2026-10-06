import { expect, test, type Page } from '@playwright/test';

// Research media: the OopsieVerse and damage HUD clips, and the RoboBoat photo.
// Nothing loads with the page; a clip downloads when it first plays and plays
// only while its entry is on screen; reduced motion and no-JS visitors see the
// posters. Laptops show the pinned panel, phones the copy inside each entry.

const isClip = (url: string) => /\.mp4($|\?)/.test(url);

function box(isMobile: boolean, index: number) {
  return isMobile ? `.rs-entry[data-media="${index}"] .entry-media` : `#rsMedia > :nth-child(${index + 1})`;
}

/** The video or image a visitor sees for entry `index` (not the noscript copy). */
function media(page: Page, isMobile: boolean, index: number, tag: 'video' | 'img') {
  return page.locator(`${box(isMobile, index)} .stack > ${tag}`);
}

const paused = (page: Page, isMobile: boolean, index: number) =>
  media(page, isMobile, index, 'video').evaluate((v: HTMLVideoElement) => v.paused);

/** Centers an entry on a laptop, or its inline media on a phone. */
async function center(page: Page, isMobile: boolean, index: number) {
  const target = isMobile ? box(true, index) : `.rs-entry[data-media="${index}"]`;
  await page.locator(target).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
}

test('no clip, poster or photo downloads with the page', async ({ page }) => {
  // Anything fetched early competes with the hero photo, the page's LCP.
  const requested = new Set<string>();
  page.on('request', (request) => requested.add(new URL(request.url()).pathname));
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const deferred = await page.evaluate(() => [
    ...Array.from(document.querySelectorAll<HTMLVideoElement>('.stack video'), (v) => v.dataset.src!),
    ...Array.from(document.querySelectorAll<HTMLImageElement>('.stack img[data-src]'), (img) => [
      img.dataset.src!,
      ...img.dataset.srcset!.split(',').map((candidate) => candidate.trim().split(/\s+/)[0]),
    ]).flat(),
  ]);
  expect(deferred.length).toBeGreaterThan(0);
  expect(deferred.filter((path) => requested.has(path))).toEqual([]);
});

test('no clip downloads with the page, even where preload="none" is ignored', async ({ page }) => {
  // preload="none" is only a hint: WebKit on Linux fetched both clips with the page anyway. The page,
  // served with preload="auto", stands in for such a browser.
  await page.route('/', async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()).replaceAll('preload="none"', 'preload="auto"') });
  });
  const clips = new Set<string>();
  page.on('request', (request) => {
    if (isClip(request.url())) clips.add(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect([...clips]).toEqual([]);
});

test('a clip downloads only once its entry is on screen', async ({ page, isMobile }) => {
  const clips = new Set<string>();
  page.on('request', (request) => {
    if (isClip(request.url())) clips.add(new URL(request.url()).pathname);
  });
  await page.goto('/');
  await page.waitForLoadState('networkidle');
  expect([...clips]).toEqual([]);
  const first = await media(page, isMobile, 0, 'video').evaluate((v: HTMLVideoElement) => v.dataset.src!);
  await center(page, isMobile, 0);
  await expect.poll(() => [...clips]).toEqual([first]);
});

test("only the active entry's clip plays", async ({ page, isMobile }) => {
  await page.goto('/');
  await center(page, isMobile, 0);
  await expect.poll(() => paused(page, isMobile, 0)).toBe(false);
  expect(await paused(page, isMobile, 1)).toBe(true);
  await center(page, isMobile, 1);
  await expect.poll(() => paused(page, isMobile, 1)).toBe(false);
  await expect.poll(() => paused(page, isMobile, 0)).toBe(true);
});

test('the RoboBoat photo loads once its entry is near', async ({ page, isMobile }) => {
  await page.goto('/');
  const photo = media(page, isMobile, 2, 'img');
  await expect(photo).not.toHaveAttribute('src', /./);
  await center(page, isMobile, 2);
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  await expect(photo).toHaveAttribute('alt', /\S/);
});

test.describe('with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('reduced motion keeps each clip on its poster', async ({ page, isMobile }) => {
    const clips = new Set<string>();
    page.on('request', (request) => {
      if (isClip(request.url())) clips.add(request.url());
    });
    await page.goto('/');
    for (const index of [0, 1]) {
      await center(page, isMobile, index);
      await page.waitForTimeout(600);
      expect(await paused(page, isMobile, index)).toBe(true);
      const poster = media(page, isMobile, index, 'img');
      await expect.poll(() => poster.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    }
    expect([...clips]).toEqual([]);
  });
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('without JavaScript the posters and the photo still show', async ({ page, isMobile }) => {
    await page.goto('/');
    for (const index of [0, 1, 2]) {
      await page.locator(box(isMobile, index)).scrollIntoViewIfNeeded();
      const still = page.locator(`${box(isMobile, index)} .stack noscript img`);
      await expect.poll(() => still.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
      // Nothing plays a video without JavaScript, and browsers would draw their own controls over the poster.
      await expect(page.locator(`${box(isMobile, index)} .stack video`)).toBeHidden();
    }
  });
});

test("line-art fills match a research frame's surface", async ({ page, isMobile }) => {
  await page.goto('/');
  // No research entry uses a drawing today, so each frame borrows the pour from Experience's panel. A solid
  // hides what lies behind it with a fill, which must be the frame's surface and not the page's. .rs-media
  // paints its surface at every width; .entry-frame only in the phone layout (900px and narrower), and has
  // none on laptops, where its figure is hidden.
  for (const frame of isMobile ? ['.rs-media', '.entry-frame'] : ['.rs-media']) {
    const { fill, frameBg, pageBg } = await page.evaluate((selector) => {
      const art = document.querySelector('#exArt svg[data-art="pour"]')!.cloneNode(true) as SVGSVGElement;
      const target = document.querySelector(selector)!;
      target.append(art);
      const paint = (el: Element, property: string) => getComputedStyle(el).getPropertyValue(property);
      return {
        fill: paint(art.querySelector('path[style*="--la-bg"]')!, 'fill'),
        frameBg: paint(target, 'background-color'),
        pageBg: paint(document.documentElement, 'background-color'),
      };
    }, frame);
    expect(fill, `${frame}: a solid's fill`).toBe(frameBg);
    // Were the two the same, the fill could match without the frame's surface being used.
    expect(frameBg, `${frame}: the frame's surface`).not.toBe(pageBg);
  }
});
