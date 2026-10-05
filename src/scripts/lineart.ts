// Pauses each drawing's flowing strokes while it is off-screen.
export function initLineArt(): void {
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) entry.target.classList.toggle('la-paused', !entry.isIntersecting);
  });
  document.querySelectorAll('svg[data-art]').forEach((svg) => observer.observe(svg));
}
