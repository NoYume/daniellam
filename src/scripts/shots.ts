// On touch screens there is no hover, so a photo turns to color while it
// crosses the middle of the screen.
export function initShots(): void {
  if (!matchMedia('(hover: none)').matches) return;
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) entry.target.classList.toggle('in-view', entry.isIntersecting);
    },
    { rootMargin: '-35% 0px -35% 0px' },
  );
  document.querySelectorAll('.shot').forEach((shot) => observer.observe(shot));
}
