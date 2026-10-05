// Research media: posters and photos load near view, and the videos inside the
// entries, which phones show in place of the pinned panel, play while on screen.

/**
 * Gives each image its address once it comes within 600px of the screen.
 * loading="lazy" alone isn't enough: Chrome fetches lazy images 2500-3000px
 * ahead on slow or unknown connections, during page load, against the hero.
 */
export function initDeferredImages(selector: string): void {
  const observer = new IntersectionObserver(
    (list) => {
      for (const entry of list) {
        if (!entry.isIntersecting) continue;
        const img = entry.target as HTMLImageElement;
        img.srcset = img.dataset.srcset ?? '';
        img.src = img.dataset.src ?? '';
        observer.unobserve(img);
      }
    },
    { rootMargin: '600px 0px' },
  );
  document.querySelectorAll<HTMLImageElement>(selector).forEach((img) => observer.observe(img));
}

/**
 * Each video inside an entry plays while it is on screen, never under reduced
 * motion. Its preload="none" keeps the file from downloading until the first play.
 */
export function initInlineVideos(selector: string): void {
  const videos = Array.from(document.querySelectorAll<HTMLVideoElement>(selector));
  if (videos.length === 0) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const onScreen = new Set<HTMLVideoElement>();
  const sync = (video: HTMLVideoElement) => {
    if (onScreen.has(video) && !reduce.matches) video.play().catch(() => {});
    else video.pause();
  };
  const observer = new IntersectionObserver(
    (list) => {
      for (const entry of list) {
        const video = entry.target as HTMLVideoElement;
        if (entry.isIntersecting) onScreen.add(video);
        else onScreen.delete(video);
        sync(video);
      }
    },
    { threshold: 0.25 },
  );
  videos.forEach((video) => observer.observe(video));
  reduce.addEventListener('change', () => videos.forEach(sync));
}
