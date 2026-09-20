// How talkative Sizzle is. Pure, so the rule can be tested.
//
//   urgent  something needs the cook (ready / flip / start it now): always said, and ahead of any chat
//   reply   a direct answer to something the cook just did to her (the greeting): always said
//   chat    optional colour (a timer started, synced, the once-a-minute nudge): only if she's been
//           quiet for a while, so adding five timers in a row gets one remark, not five

export type Priority = 'urgent' | 'reply' | 'chat'

export const CHAT_COOLDOWN_MS = 20_000

export interface Mood {
  busy: boolean // speaking, or has lines queued
  quietForMs: number // since she last finished (or started) saying anything
}

export function shouldSay(priority: Priority, mood: Mood): boolean {
  if (priority !== 'chat') return true
  return !mood.busy && mood.quietForMs >= CHAT_COOLDOWN_MS
}
