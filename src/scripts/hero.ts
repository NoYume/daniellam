// The hero after the first paint: the photo swap when the mode changes, and
// the depth parallax on scroll (spec 7.4 and 7.5).
import type { HeroPhoto } from '../lib/hero-data';
import { onModeChange } from './mode';

declare global {
  interface Window {
    /** Set by the head script in Base.astro: every photo, and the one it picked. */
    __hero?: { photos: HeroPhoto[]; pick: HeroPhoto };
  }
}

const FADE_MS = 800;

function buildPicture(photo: HeroPhoto): { picture: HTMLPictureElement; img: HTMLImageElement } {
  const picture = document.createElement('picture');
  picture.className = 'hero-photo';
  for (const [type, srcset] of [
    ['image/avif', photo.avif],
    ['image/webp', photo.webp],
  ]) {
    const source = document.createElement('source');
    source.type = type;
    source.sizes = '100vw';
    source.srcset = srcset;
    picture.append(source);
  }
  const img = document.createElement('img');
  img.width = photo.width;
  img.height = photo.height;
  img.alt = photo.alt;
  img.decoding = 'async';
  img.dataset.photo = photo.id;
  img.dataset.set = photo.set;
  img.src = photo.src;
  picture.append(img);
  return { picture, img };
}

export function initHero(): void {
  const hero = document.querySelector<HTMLElement>('.hero');
  const data = window.__hero;
  if (!hero || !data) return;
  const media = hero.querySelector<HTMLElement>('.hero-media')!;
  const haze = hero.querySelector<HTMLElement>('.haze')!;
  const content = hero.querySelector<HTMLElement>('.hero-content')!;

  const describe = (photo: HeroPhoto) => {
    const credit = document.getElementById('credit');
    if (credit) credit.textContent = photo.credit;
    const footCredit = document.getElementById('footCredit');
    if (footCredit) footCredit.textContent = photo.footCredit;
    hero.dataset.haze = photo.haze;
    document.documentElement.dataset.hero = photo.id;
  };
  describe(data.pick);

  // A mode switch loads a random photo from the other set and crossfades to it
  // once it has decoded. The ticket makes the last switch win, whichever photo
  // finishes loading first.
  let ticket = 0;
  onModeChange((mode) => {
    const mine = ++ticket;
    const set = mode === 'light' ? 'day' : 'night';
    const list = data.photos.filter((p) => p.set === set);
    const photo = list[Math.floor(Math.random() * list.length)];
    if (!photo) return;
    const { picture, img } = buildPicture(photo);
    media.append(picture);
    img.decode().then(
      () => {
        if (mine !== ticket) {
          picture.remove();
          return;
        }
        describe(photo);
        img.classList.add('on');
        setTimeout(() => {
          if (mine !== ticket) return;
          media.querySelectorAll('.hero-photo').forEach((el) => el !== picture && el.remove());
        }, FADE_MS + 100);
      },
      // A photo that fails to load leaves the current one in place.
      () => picture.remove(),
    );
  });

  // Depth parallax: the photo moves at .55× the scroll, the haze at .3× and
  // the title at .18× while it fades. Reduced motion keeps everything still.
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let queued = false;
  const apply = () => {
    queued = false;
    if (reduce.matches) {
      media.style.transform = haze.style.transform = content.style.transform = content.style.opacity = '';
      return;
    }
    const height = hero.offsetHeight;
    const s = Math.min(height, Math.max(0, window.scrollY));
    const p = s / height;
    media.style.transform = `translate3d(0, ${(s * 0.55).toFixed(1)}px, 0) scale(${(1 + p * 0.08).toFixed(4)})`;
    haze.style.transform = `translate3d(0, ${(s * 0.3).toFixed(1)}px, 0)`;
    content.style.transform = `translate3d(0, ${(s * 0.18).toFixed(1)}px, 0)`;
    content.style.opacity = Math.max(0, 1 - p * 1.6).toFixed(3);
  };
  const queue = () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  };
  addEventListener('scroll', queue, { passive: true });
  addEventListener('resize', queue);
  // A reload or Back can restore a mid-page scroll after this runs.
  addEventListener('load', apply);
  addEventListener('pageshow', apply);
  reduce.addEventListener('change', apply);
  apply();
}
