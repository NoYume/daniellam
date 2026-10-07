// Small text helpers shared by the Shots page and its tests.

// A table, not Date, so no time zone can shift a month.
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** '2026-03' gives 'March 2026'. */
export function formatMonth(month: string): string {
  const [year, number] = month.split('-');
  return `${MONTHS[Number(number) - 1]} ${year}`;
}

/** 1 gives '1 photo', 6 gives '6 photos'. */
export function photoCount(n: number): string {
  return `${n} ${n === 1 ? 'photo' : 'photos'}`;
}

/** "Caption. Photo: Credit", either part alone, or nothing when a photo has neither. */
export function captionText(photo: { caption?: string; credit?: string }): string | undefined {
  const credit = photo.credit ? `Photo: ${photo.credit}` : undefined;
  if (photo.caption && credit) return `${photo.caption}. ${credit}`;
  return photo.caption || credit;
}
