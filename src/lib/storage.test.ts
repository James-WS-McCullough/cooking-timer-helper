import { describe, expect, it } from 'vitest'
import { CURRENT_VERSION, parseSaved, serialise } from './storage'
import { createTimer, NO_ALERTS } from './timer'

const MIN = 60_000

describe('parseSaved', () => {
  it('starts empty for nothing, junk, or the wrong shape', () => {
    for (const raw of [null, '', 'not json', '[]', '42', '{"timers":"nope"}']) {
      expect(parseSaved(raw)).toEqual({ version: CURRENT_VERSION, timers: [], presets: [], history: {} })
    }
  })

  it('upgrades version 1 data (no version, no history, plan-less items) without losing anything', () => {
    const v1 = {
      timers: [
        {
          id: 't1',
          name: 'Rice',
          durationMs: 10 * MIN,
          elapsedMs: 0,
          runningSince: 1000,
          pausedBy: null,
          finishedAt: null,
          createdAt: 1000,
        },
      ],
      presets: [{ id: 'p1', name: 'Eggs', durationMs: 6 * MIN }],
    }
    const saved = parseSaved(JSON.stringify(v1))
    expect(saved.version).toBe(CURRENT_VERSION)
    expect(saved.history).toEqual({})
    expect(saved.timers[0]).toMatchObject({ id: 't1', name: 'Rice', plan: NO_ALERTS, alerts: [], prepped: false })
    expect(saved.presets[0]).toMatchObject({ id: 'p1', name: 'Eggs', plan: NO_ALERTS })
  })

  it('drops only the entries it cannot use', () => {
    const raw = JSON.stringify({
      version: CURRENT_VERSION,
      timers: [{ id: 'ok', durationMs: MIN }, { durationMs: MIN }, null, { id: 'zero', durationMs: 0 }],
      presets: [{ id: 'p', durationMs: MIN }, 'junk'],
      history: { rice: [MIN] },
    })
    const saved = parseSaved(raw)
    expect(saved.timers.map((t) => t.id)).toEqual(['ok'])
    expect(saved.presets.map((p) => p.id)).toEqual(['p'])
    expect(saved.history).toEqual({ rice: [MIN] })
  })

  it('round-trips what the app writes', () => {
    const timers = [
      createTimer('Potatoes', 40 * MIN, { kind: 'half', everyMs: 0, label: 'Flip', pause: true }, 5000, true),
    ]
    const presets = [{ id: 'p1', name: 'Rice', durationMs: 12 * MIN, plan: NO_ALERTS }]
    const history = { potatoes: [40 * MIN] }
    expect(parseSaved(serialise({ timers, presets, history }))).toEqual({
      version: CURRENT_VERSION,
      timers,
      presets,
      history,
    })
  })

  it('does not pretend to downgrade data from a newer version', () => {
    expect(parseSaved(JSON.stringify({ version: 99, timers: [], presets: [] })).version).toBe(99)
  })
})
