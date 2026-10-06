// A pinned panel that follows the entry crossing the middle of the screen:
// Research's media and Experience's drawings. Videos play only while their
// entry is active and the panel is on screen.
import { playClip } from './media';

export function initPinned(opts: { entries: string; panel: string; key: string; caption?: string }): void {
  const panel = document.querySelector<HTMLElement>(opts.panel);
  if (!panel) return;
  const items = Array.from(panel.children) as HTMLElement[];
  const caption = opts.caption ? document.querySelector(opts.caption) : null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let active = 0;
  let panelVisible = false;

  const videoOf = (item: HTMLElement) => (item instanceof HTMLVideoElement ? item : item.querySelector('video'));
  const sync = () => {
    items.forEach((item, i) => {
      const video = videoOf(item);
      if (!video) return;
      if (i === active && panelVisible && !reduce.matches) playClip(video);
      else video.pause();
    });
  };
  const show = (index: number) => {
    if (!items[index]) return;
    active = index;
    items.forEach((item, i) => item.classList.toggle('on', i === index));
    if (caption) caption.textContent = items[index].dataset.cap ?? '';
    sync();
  };

  const entries = new IntersectionObserver(
    (list) => {
      for (const entry of list) {
        if (entry.isIntersecting) show(Number((entry.target as HTMLElement).dataset[opts.key]));
      }
    },
    { rootMargin: '-48% 0px -48% 0px' },
  );
  document.querySelectorAll(opts.entries).forEach((el) => entries.observe(el));

  new IntersectionObserver(([entry]) => {
    panelVisible = entry.isIntersecting;
    sync();
  }).observe(panel);
  reduce.addEventListener('change', sync);
}
