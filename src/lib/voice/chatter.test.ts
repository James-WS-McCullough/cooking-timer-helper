import { describe, expect, it } from 'vitest'
import { CHAT_COOLDOWN_MS, shouldSay } from './chatter'

const quiet = { busy: false, quietForMs: 60_000 }

describe('how talkative Sizzle is', () => {
  it('always says what needs the cook, and always answers', () => {
    for (const mood of [quiet, { busy: true, quietForMs: 0 }, { busy: false, quietForMs: 1000 }]) {
      expect(shouldSay('urgent', mood)).toBe(true)
      expect(shouldSay('reply', mood)).toBe(true)
    }
  })

  it('only chats when she has been quiet for a while', () => {
    expect(shouldSay('chat', quiet)).toBe(true)
    expect(shouldSay('chat', { busy: false, quietForMs: CHAT_COOLDOWN_MS })).toBe(true)
    expect(shouldSay('chat', { busy: false, quietForMs: CHAT_COOLDOWN_MS - 1 })).toBe(false)
    expect(shouldSay('chat', { busy: true, quietForMs: 60_000 })).toBe(false) // mid-sentence, or lines waiting
  })
})
