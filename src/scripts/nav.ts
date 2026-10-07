// The fixed bar: solid after the first scroll, the name docked after the
// hero title, the current section underlined (or the page's own link kept in
// view), and the theme button.
import { getMode, setMode, type Mode } from './mode';

export function initNav(): void {
  const bar = document.querySelector<HTMLElement>('.bar');
  if (!bar) return;

  const sentinel = document.getElementById('sentinel');
  if (sentinel) new IntersectionObserver(([e]) => bar.classList.toggle('solid', !e.isIntersecting)).observe(sentinel);

  // Pages without a hero (the 404 and Shots pages) show the name from the start.
  const heroName = document.querySelector('.hero-name');
  if (heroName) {
    new IntersectionObserver(([e]) => bar.classList.toggle('docked', !e.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
    }).observe(heroName);
  } else {
    bar.classList.add('docked');
  }

  // The scroll spy runs on the homepage only (the page with a hero), so on another page
  // it never clears the mark on that page's own link.
  if (document.querySelector('.hero')) {
    const links = new Map<string, HTMLAnchorElement>();
    bar.querySelectorAll<HTMLAnchorElement>('.bar-links a').forEach((a) => links.set(a.hash.slice(1), a));
    const spy = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          for (const [id, a] of links) a.classList.toggle('is-active', id === entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -50% 0px' },
    );
    document.querySelectorAll('main section, .hero').forEach((section) => spy.observe(section));
  }

  // On phones the links scroll sideways: start the row scrolled so the page's own link shows.
  // Through scrollLeft, since scrollIntoView could move the page too. Again once the fonts are
  // in, as they change the links' widths.
  const row = bar.querySelector<HTMLElement>('.bar-links');
  const current = row?.querySelector<HTMLElement>('[aria-current="page"]');
  if (row && current) {
    const reveal = () => {
      const r = row.getBoundingClientRect();
      const c = current.getBoundingClientRect();
      if (c.right > r.right) row.scrollLeft += Math.ceil(c.right - r.right);
      else if (c.left < r.left) row.scrollLeft -= Math.ceil(r.left - c.left);
    };
    reveal();
    document.fonts.ready.then(reveal);
  }

  const button = bar.querySelector<HTMLButtonElement>('.theme-btn');
  if (!button) return;
  const label = (mode: Mode) => button.setAttribute('aria-label', mode === 'light' ? 'Switch to dark mode' : 'Switch to light mode');
  label(getMode());
  button.addEventListener('click', () => {
    const next: Mode = getMode() === 'light' ? 'dark' : 'light';
    setMode(next);
    label(next);
  });
}
