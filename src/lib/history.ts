// Remembers the times last used for each timer name, so "How long?" can offer
// them as a one-tap shortcut: most cooking is a repeat of last time.

export type TimeHistory = Record<string, number[]>

const KEEP = 3 // per name, most recent first

const keyFor = (name: string) => name.trim().toLowerCase()

/** Record a time for a name. Unnamed timers aren't remembered: there'd be nothing to tell them apart. */
export function rememberTime(history: TimeHistory, name: string, durationMs: number): void {
  const key = keyFor(name)
  if (!key) return
  history[key] = [durationMs, ...(history[key] ?? []).filter((ms) => ms !== durationMs)].slice(0, KEEP)
}

export function recentTimes(history: TimeHistory, name: string): number[] {
  return history[keyFor(name)] ?? []
}
