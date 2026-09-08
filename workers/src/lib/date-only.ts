const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Render a stored ISO timestamp as a calendar date using the UTC date-only
 * components. Does not construct a local Date that would shift UTC midnight
 * to the previous day in US timezones.
 */
export function formatUtcDateOnly(iso: string | null | undefined): string {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return '—'
  const month = MONTHS[Number(match[2]) - 1]
  if (!month) return '—'
  return `${month} ${Number(match[3])}, ${match[1]}`
}
