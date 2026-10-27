// Which photos the Culling view shows.

// Whether a photo with rating `r` shows under `filter`: 'all' | 'rated' | 'unrated'
// | 'rejects' (auto-rating's picks, checked by the caller) | 'stars:N+' (N or more)
// | 'stars:N' (exactly N).
export function inFilter(filter, r) {
  if (filter === 'rated') return r > 0;
  if (filter === 'unrated') return r <= 0;
  const m = /^stars:(\d)(\+?)$/.exec(filter);
  if (m) return m[2] ? r >= +m[1] : r === +m[1];
  return true;
}
export const STAR_FILTERS = [
  ...[2, 3, 4].map((n) => [`stars:${n}+`, `${'★'.repeat(n)} and up`]),
  ...[1, 2, 3, 4, 5].map((n) => [`stars:${n}`, `Only ${'★'.repeat(n)}`]),
];
