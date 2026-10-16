export function money(n: number, currency: string, compact = false): string {
  if (!Number.isFinite(n)) return '–'
  try {
    return new Intl.NumberFormat(currency === 'INR' ? 'en-IN' : 'en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
      notation: compact && Math.abs(n) >= 100_000 ? 'compact' : 'standard',
    }).format(Math.round(n))
  } catch {
    return `${currency} ${Math.round(n).toLocaleString('en')}`
  }
}

export const pct = (x: number) => `${Math.round((x || 0) * 100)}%`

export function shortDate(iso: string) {
  const d = new Date(`${iso}T00:00:00`)
  return Number.isNaN(+d) ? iso : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

export function monthLabel(ym: string) {
  const d = new Date(`${ym}-01T00:00:00`)
  return Number.isNaN(+d) ? ym : d.toLocaleDateString('en-GB', { month: 'short' })
}

export const COUNTRIES: Record<string, { name: string; currency: string; language: string; flag: string }> = {
  IN: { name: 'India', currency: 'INR', language: 'hi', flag: '🇮🇳' },
  ID: { name: 'Indonesia', currency: 'IDR', language: 'id', flag: '🇮🇩' },
  PH: { name: 'Philippines', currency: 'PHP', language: 'tl', flag: '🇵🇭' },
}
