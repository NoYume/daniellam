// The fixed bar: solid after the first scroll, the name docked after the
// hero title, the current section underlined, and the theme button.
import { getMode, setMode, type Mode } from './mode';

export function initNav(): void {
  const bar = document.querySelector<HTMLElement>('.bar');
  if (!bar) return;

  const sentinel = document.getElementById('sentinel');
  if (sentinel) new IntersectionObserver(([e]) => bar.classList.toggle('solid', !e.isIntersecting)).observe(sentinel);

  // Pages without a hero (the 404) show the name from the start.
  const heroName = document.querySelector('.hero-name');
  if (heroName) {
    new IntersectionObserver(([e]) => bar.classList.toggle('docked', !e.isIntersecting), {
      rootMargin: '-64px 0px 0px 0px',
    }).observe(heroName);
  } else {
    bar.classList.add('docked');
  }

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
