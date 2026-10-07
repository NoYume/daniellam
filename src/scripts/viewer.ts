// The Shots page's viewer (spec 5.2): a click on a photo opens it large in a
// <dialog>, the arrow keys, the buttons and swipes step through its trip, and
// closing returns focus to the photo. Without JavaScript the photo's link opens
// the image itself.

/** i wrapped into 0..n-1, so stepping past either end goes round. */
export function wrapIndex(i: number, n: number): number {
  return ((i % n) + n) % n;
}

/**
 * The step a swipe makes: 1 (next) for a swipe to the left, -1 for one to the right,
 * and 0 unless it moved at least 40px sideways and further sideways than down.
 */
export function swipeStep(dx: number, dy: number): -1 | 0 | 1 {
  if (Math.abs(dx) < 40 || Math.abs(dx) <= Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/** Only a plain primary click opens the viewer; with a modifier key the link does its own thing, such as a new tab. */
export function opensViewer(e: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean }): boolean {
  return e.button === 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey;
}

export function initViewer(): void {
  const dialog = document.querySelector<HTMLDialogElement>('#viewer');
  // A browser without <dialog> keeps the plain links.
  if (!dialog || typeof dialog.showModal !== 'function') return;
  const fig = dialog.querySelector<HTMLElement>('.v-fig')!;
  const photo = dialog.querySelector<HTMLElement>('.v-photo')!;
  const cap = dialog.querySelector<HTMLElement>('.v-cap')!;
  const count = dialog.querySelector<HTMLElement>('.v-count')!;
  const prev = dialog.querySelector<HTMLButtonElement>('.v-prev')!;
  const next = dialog.querySelector<HTMLButtonElement>('.v-next')!;
  const close = dialog.querySelector<HTMLButtonElement>('.v-close')!;

  // The open trip: its photos' links in page order, its name, the photo on show and the link that opened it.
  let links: HTMLAnchorElement[] = [];
  let trip = '';
  let index = 0;
  let opener: HTMLAnchorElement | undefined;

  const show = (i: number) => {
    index = i;
    const link = links[i]!;
    // The photo's own <picture>, sized for the whole screen, so the browser picks a larger file from the same set.
    const picture = link.querySelector('picture')!.cloneNode(true) as HTMLPictureElement;
    picture.querySelectorAll('source, img').forEach((el) => el.setAttribute('sizes', '100vw'));
    const img = picture.querySelector('img')!;
    img.loading = 'eager';
    // Its shape, so the photo takes its size at once, before the larger file arrives.
    img.style.setProperty('--ar', String(Number(img.getAttribute('width')) / Number(img.getAttribute('height'))));
    photo.replaceChildren(picture);
    cap.textContent = link.closest('figure')?.querySelector('figcaption')?.textContent?.trim() ?? '';
    count.textContent = `${trip}, ${i + 1} of ${links.length}`;
  };
  const step = (d: number) => {
    if (links.length > 1) show(wrapIndex(index + d, links.length));
  };

  document.addEventListener('click', (e) => {
    const link = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>('article.trip a.ph-link') : null;
    if (!link || !opensViewer(e)) return;
    e.preventDefault();
    // The second click of a double-click: the first one opened the viewer or closed it, so this one
    // neither opens it again nor follows the link.
    if (e.detail > 1) return;
    // The page holds still under the viewer, so a scroll still running stops here. Opened from the
    // keyboard (a click with no click count), that scroll is the browser bringing the focused photo
    // into view: it ends with the photo on screen, where focus comes back to.
    scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' });
    if (e.detail === 0) link.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    const article = link.closest('article.trip')!;
    links = Array.from(article.querySelectorAll<HTMLAnchorElement>('a.ph-link'));
    trip = article.querySelector('.trip-name')?.textContent?.trim() ?? '';
    opener = link;
    // A trip of one photo hides previous and next but keeps their places, so the photo stays put.
    prev.style.visibility = next.style.visibility = links.length > 1 ? '' : 'hidden';
    show(links.indexOf(link));
    dialog.showModal();
    close.focus();
    document.documentElement.classList.add('v-open');
  });

  prev.addEventListener('click', () => step(-1));
  next.addEventListener('click', () => step(1));
  dialog.addEventListener('keydown', (e) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    // With a modifier, an arrow key stays the browser's (Alt+Left goes back).
    if (!d || e.altKey || e.ctrlKey || e.metaKey) return;
    e.preventDefault();
    step(d);
  });

  // Swipes, for touch and pens: the photo's touch-action leaves sideways moves to this script, not the browser.
  let swipe: { id: number; x: number; y: number } | undefined;
  dialog.addEventListener('pointerdown', (e) => {
    swipe = e.pointerType !== 'mouse' && e.isPrimary ? { id: e.pointerId, x: e.clientX, y: e.clientY } : undefined;
  });
  dialog.addEventListener('pointerup', (e) => {
    if (!swipe || e.pointerId !== swipe.id) return;
    const d = swipeStep(e.clientX - swipe.x, e.clientY - swipe.y);
    swipe = undefined;
    if (d) step(d);
  });

  // A click outside the photo closes the viewer: on the dialog around it, not the image, the caption or a button.
  // Not the second click of a double-click, which would close the viewer its first click opened.
  dialog.addEventListener('click', (e) => {
    if (e.detail > 1) return;
    if (e.target === dialog || e.target === fig || e.target === photo) dialog.close();
  });
  close.addEventListener('click', () => dialog.close());
  // Esc closes the dialog by itself.
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('v-open');
    photo.replaceChildren();
    // The page couldn't scroll meanwhile, so the photo is where it was; focusing it mustn't move the page.
    opener?.focus({ preventScroll: true });
  });
}
