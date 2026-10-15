// Something to watch while cooking: a YouTube video or live stream, or a Twitch channel or
// video, from whatever link the cook pastes. Only those two: most sites refuse to be embedded
// anyway. Pure: what the link means, and the embed address for it.

export type Watchable =
  | { site: 'youtube'; id: string; live?: false; start?: number }
  | { site: 'youtube'; channel: string; live: true }
  | { site: 'twitch'; channel: string }
  | { site: 'twitch'; video: string; start?: number }

const YT_ID = /^[\w-]{11}$/

/** A link's start time in seconds: "354", "354s", "5m54s", "1h2m3s". 0 or junk is no start. */
export function parseStart(value: string | null): number | undefined {
  if (!value) return undefined
  const v = value.trim().toLowerCase()
  if (/^\d+s?$/.test(v)) return Number.parseInt(v, 10) || undefined
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v)
  if (!m || !v) return undefined
  const s = Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0)
  return s || undefined
}

const hms = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return `${h}h${m}m${s % 60}s`
}

/** What a pasted link points at, or null if it isn't a YouTube or Twitch link we can show. */
export function parseWatchUrl(text: string): Watchable | null {
  let url: URL
  try {
    url = new URL(text.trim().match(/^https?:\/\//) ? text.trim() : `https://${text.trim()}`)
  } catch {
    return null
  }
  const host = url.hostname.replace(/^(www|m|music)\./, '')
  const path = url.pathname.split('/').filter(Boolean)

  const start = parseStart(url.searchParams.get('t') ?? url.searchParams.get('start') ?? url.searchParams.get('time'))
  const at = start ? { start } : {}

  if (host === 'youtu.be') {
    const id = path[0] ?? ''
    return YT_ID.test(id) ? { site: 'youtube', id, ...at } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v') ?? ''
    if (YT_ID.test(v)) return { site: 'youtube', id: v, ...at }
    const [kind, id] = path
    if ((kind === 'embed' || kind === 'live' || kind === 'shorts' || kind === 'v') && id && YT_ID.test(id))
      return { site: 'youtube', id, ...at }
    if (kind === 'embed' && id === 'live_stream') {
      const channel = url.searchParams.get('channel') ?? ''
      return channel ? { site: 'youtube', channel, live: true } : null
    }
    if (kind === 'channel' && id) return { site: 'youtube', channel: id, live: true }
    return null
  }
  if (host === 'twitch.tv' || host === 'player.twitch.tv') {
    if (host === 'player.twitch.tv') {
      const channel = url.searchParams.get('channel')
      const video = url.searchParams.get('video')
      if (channel) return { site: 'twitch', channel }
      if (video) return { site: 'twitch', video: video.replace(/^v/, ''), ...at }
      return null
    }
    const [first, second, third] = path
    if (first === 'videos' && second && /^\d+$/.test(second)) return { site: 'twitch', video: second, ...at }
    if (first && second === 'video' && third && /^\d+$/.test(third)) return { site: 'twitch', video: third, ...at }
    if (first && /^[\w]{3,25}$/.test(first) && !second) return { site: 'twitch', channel: first }
    return null
  }
  return null
}

/**
 * The iframe address, starting where the link said. YouTube's ordinary player (not the
 * no-cookie one) so that, where the browser allows it, the cook's own login and Premium
 * apply. Twitch insists on knowing who is embedding it (`parent`).
 */
export function embedUrl(w: Watchable, parentHost: string): string {
  if (w.site === 'youtube') {
    const base = 'https://www.youtube.com/embed/'
    if (w.live) return `${base}live_stream?channel=${encodeURIComponent(w.channel)}`
    return `${base}${w.id}?playsinline=1&rel=0${w.start ? `&start=${w.start}` : ''}`
  }
  const what =
    'channel' in w
      ? `channel=${encodeURIComponent(w.channel)}`
      : `video=${encodeURIComponent(w.video)}${w.start ? `&time=${hms(w.start)}` : ''}`
  return `https://player.twitch.tv/?${what}&parent=${encodeURIComponent(parentHost)}&autoplay=false`
}

/** A short line naming what's on: "YouTube", "Twitch · channelname". */
export function describeWatchable(w: Watchable): string {
  const from =
    'start' in w && w.start ? ` · from ${Math.floor(w.start / 60)}:${String(w.start % 60).padStart(2, '0')}` : ''
  if (w.site === 'youtube') return w.live ? 'YouTube · live' : `YouTube${from}`
  if ('video' in w) return `Twitch · video ${w.video}${from}`
  return `Twitch · ${w.channel}`
}
