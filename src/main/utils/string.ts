/** Truncate a string to `n` characters with a trailing ellipsis if needed. */
export function truncate(s: string, n = 40): string {
  return s.length > n ? s.slice(0, n) + '…' : s
}
