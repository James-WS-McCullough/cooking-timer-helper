// What's kept on the device, and how old copies of it are brought up to date.
// Parsing never throws and never drops data it can make sense of: a cook's
// presets should survive any update.

import type { TimeHistory } from './history'
import { type AlertPlan, NO_ALERTS, type Timer } from './timer'

export interface Preset {
  id: string
  name: string
  durationMs: number
  plan: AlertPlan
}

export interface Saved {
  version: number
  timers: Timer[]
  presets: Preset[]
  history: TimeHistory
}

/** The key's "v1" predates the version field below and stays put, so nobody's data is orphaned. */
export const STORAGE_KEY = 'sizzle:v1'

/**
 * Bump when the saved shape changes in a way old code or new code would trip
 * over, and add a step to MIGRATIONS that upgrades the previous version.
 *   1: timers + presets (no version field)
 *   2: + history; timers may carry prepped / sync fields; every timer and preset has a plan
 */
export const CURRENT_VERSION = 2

type Loose = Record<string, unknown>

const MIGRATIONS: Record<number, (data: Loose) => void> = {
  1: (data) => {
    data.history = {}
    for (const list of [data.timers, data.presets]) {
      for (const item of list as Loose[]) item.plan ??= { ...NO_ALERTS }
    }
    for (const timer of data.timers as Loose[]) {
      timer.alerts ??= []
      timer.prepped ??= false
    }
  },
}

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const usable = (item: unknown): item is Loose =>
  isRecord(item) && typeof item.id === 'string' && typeof item.durationMs === 'number' && item.durationMs > 0

export function emptySaved(): Saved {
  return { version: CURRENT_VERSION, timers: [], presets: [], history: {} }
}

export function parseSaved(raw: string | null): Saved {
  if (!raw) return emptySaved()
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    return emptySaved()
  }
  if (!isRecord(data)) return emptySaved()

  // Anything that isn't a recognisable timer or preset is dropped on its own, not with the rest.
  data.timers = Array.isArray(data.timers) ? data.timers.filter(usable) : []
  data.presets = Array.isArray(data.presets) ? data.presets.filter(usable) : []

  let version = typeof data.version === 'number' ? data.version : 1
  while (version < CURRENT_VERSION) {
    MIGRATIONS[version]?.(data)
    version++
  }

  return {
    // Written by a newer Sizzle (say, another tab mid-update): keep its version so we don't claim to have downgraded it.
    version: Math.max(version, CURRENT_VERSION),
    timers: data.timers as Timer[],
    presets: data.presets as Preset[],
    history: isRecord(data.history) ? (data.history as TimeHistory) : {},
  }
}

export function serialise(saved: Omit<Saved, 'version'>): string {
  return JSON.stringify({ version: CURRENT_VERSION, ...saved })
}
