import { describe, expect, it } from 'vitest'
import { CURRENT_VERSION, emptySaved, parseSaved, serialise } from './storage'
import { createTimer, NO_ALERTS } from './timer'

const MIN = 60_000

describe('parseSaved', () => {
  it('starts empty for nothing, junk, or the wrong shape', () => {
    for (const raw of [null, '', 'not json', '[]', '42', '{"timers":"nope"}']) {
      expect(parseSaved(raw)).toEqual(emptySaved())
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
    expect(parseSaved(serialise({ timers, notes: [], runs: [], recipes: [], presets, history }))).toEqual({
      version: CURRENT_VERSION,
      timers,
      notes: [],
      runs: [],
      recipes: [],
      presets,
      history,
    })
  })

  it('upgrades version 2 data (before recipes) and keeps a chain mid-cook', () => {
    const v2 = {
      version: 2,
      timers: [],
      presets: [{ id: 'p', name: 'Rice', durationMs: MIN, plan: NO_ALERTS }],
      history: {},
    }
    const up = parseSaved(JSON.stringify(v2))
    expect(up.version).toBe(CURRENT_VERSION)
    expect(up.presets).toHaveLength(1)
    expect(up).toMatchObject({ notes: [], runs: [], recipes: [] })

    const step = { id: 's1', kind: 'note' as const, text: 'Drain', after: [] }
    const run = { id: 'run', recipe: { id: 'r', name: '', steps: [step] }, done: [], active: ['s1'] }
    const note = { id: 'n', text: 'Drain', createdAt: 1, step: { runId: 'run', stepId: 's1' } }
    const saved = parseSaved(
      serialise({ timers: [], notes: [note], runs: [run], recipes: [], presets: [], history: {} }),
    )
    expect(saved.runs).toEqual([run])
    expect(saved.notes).toEqual([note])
    // junk in the new lists goes, on its own
    const junk = JSON.stringify({
      version: 3,
      timers: [],
      notes: [{ id: 'x' }, note],
      runs: [{}],
      recipes: [{ id: 'r', steps: 'no' }],
      presets: [],
    })
    expect(parseSaved(junk)).toMatchObject({ notes: [note], runs: [], recipes: [] })
  })

  it('does not pretend to downgrade data from a newer version', () => {
    expect(parseSaved(JSON.stringify({ version: 99, timers: [], presets: [] })).version).toBe(99)
  })
})
