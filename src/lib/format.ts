/** Countdown clock: 19:58, or 1:05:00 past the hour. Rounds up so a fresh 20 min reads 20:00. */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Count-up clock for overtime; rounds down so it starts at 0:00. */
export function formatSince(ms: number): string {
  return formatClock(Math.floor(Math.max(0, ms) / 1000) * 1000)
}

/** Short human label: "20 min", "1 min 30 s", "1 h 5 min". */
export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts: string[] = []
  if (h) parts.push(`${h} h`)
  if (m) parts.push(`${m} min`)
  if (s) parts.push(`${s} s`)
  return parts.join(' ') || '0 s'
}

/**
 * Parse what someone types into a minutes box:
 * "12" → 12 min, "1.5" → 1 min 30 s, "1:30" → 1 min 30 s, "1:05:00" → 1 h 5 min.
 * Returns null if it isn't a usable duration.
 */
export function parseDuration(text: string): number | null {
  const raw = text.trim().replace(',', '.')
  if (!raw) return null
  let seconds: number
  if (raw.includes(':')) {
    const parts = raw.split(':')
    if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
    seconds = parts.reduce((acc, p) => acc * 60 + Number(p), 0)
  } else {
    if (!/^\d*\.?\d+$/.test(raw)) return null
    seconds = Math.round(Number(raw) * 60)
  }
  const MAX = 24 * 3600
  return seconds > 0 && seconds <= MAX ? seconds * 1000 : null
}

/**
 * Typed names are usually dashed off in lowercase. If there isn't a single
 * capital in it, give it one at the front ("garlic bread" → "Garlic bread");
 * anything the cook capitalised themselves ("BBQ ribs", "mac n Cheese") is left alone.
 */
export function tidyName(text: string): string {
  const name = text.trim().replace(/\s+/g, ' ')
  if (!name || name !== name.toLowerCase()) return name
  return name.charAt(0).toUpperCase() + name.slice(1)
}
