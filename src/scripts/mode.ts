// Light or dark mode. The head script in Base.astro sets it before the first
// paint; this module switches it and tells the rest of the page.
export type Mode = 'light' | 'dark';

export function getMode(): Mode {
  return document.documentElement.dataset.mode === 'light' ? 'light' : 'dark';
}

const SWITCH_MS = 450;
let switching: ReturnType<typeof setTimeout> | undefined;

/** Switches the mode, fading the colors, and remembers it. Blocked storage only stops the remembering. */
export function setMode(mode: Mode): void {
  const html = document.documentElement;
  html.classList.add('mode-switch');
  clearTimeout(switching);
  switching = setTimeout(() => html.classList.remove('mode-switch'), SWITCH_MS);
  html.dataset.mode = mode;
  try {
    localStorage.setItem('mode', mode);
  } catch {
    // Some private windows block storage; the switch still works for this visit.
  }
  document.dispatchEvent(new CustomEvent<Mode>('modechange', { detail: mode }));
}

/** Calls fn after every mode switch. Returns a function that stops listening. */
export function onModeChange(fn: (mode: Mode) => void): () => void {
  const handler = (event: Event) => fn((event as CustomEvent<Mode>).detail);
  document.addEventListener('modechange', handler);
  return () => document.removeEventListener('modechange', handler);
}
