// Something to watch while cooking: a YouTube video or live stream, or a Twitch channel or
// video, from whatever link the cook pastes. Only those two: most sites refuse to be embedded
// anyway. Pure: what the link means, and the embed address for it.

export type Watchable =
  | { site: 'youtube'; id: string; live?: false }
  | { site: 'youtube'; channel: string; live: true }
  | { site: 'twitch'; channel: string }
  | { site: 'twitch'; video: string }

const YT_ID = /^[\w-]{11}$/

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

  if (host === 'youtu.be') {
    const id = path[0] ?? ''
    return YT_ID.test(id) ? { site: 'youtube', id } : null
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const v = url.searchParams.get('v') ?? ''
    if (YT_ID.test(v)) return { site: 'youtube', id: v }
    const [kind, id] = path
    if ((kind === 'embed' || kind === 'live' || kind === 'shorts' || kind === 'v') && id && YT_ID.test(id))
      return { site: 'youtube', id }
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
      if (video) return { site: 'twitch', video: video.replace(/^v/, '') }
      return null
    }
    const [first, second, third] = path
    if (first === 'videos' && second && /^\d+$/.test(second)) return { site: 'twitch', video: second }
    if (first && second === 'video' && third && /^\d+$/.test(third)) return { site: 'twitch', video: third }
    if (first && /^[\w]{3,25}$/.test(first) && !second) return { site: 'twitch', channel: first }
    return null
  }
  return null
}

/** The iframe address. Twitch insists on knowing who is embedding it (`parent`). */
export function embedUrl(w: Watchable, parentHost: string): string {
  if (w.site === 'youtube') {
    const base = 'https://www.youtube-nocookie.com/embed/'
    return w.live ? `${base}live_stream?channel=${encodeURIComponent(w.channel)}` : `${base}${w.id}?playsinline=1&rel=0`
  }
  const what = 'channel' in w ? `channel=${encodeURIComponent(w.channel)}` : `video=${encodeURIComponent(w.video)}`
  return `https://player.twitch.tv/?${what}&parent=${encodeURIComponent(parentHost)}&autoplay=false`
}

/** A short line naming what's on: "YouTube", "Twitch · channelname". */
export function describeWatchable(w: Watchable): string {
  if (w.site === 'youtube') return w.live ? 'YouTube · live' : 'YouTube'
  return `Twitch · ${'channel' in w ? w.channel : `video ${w.video}`}`
}
