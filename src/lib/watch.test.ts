import { describe, expect, it } from 'vitest'
import { describeWatchable, embedUrl, parseStart, parseWatchUrl } from './watch'

describe('parseWatchUrl', () => {
  it('reads the links people actually paste', () => {
    expect(parseWatchUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({ site: 'youtube', id: 'dQw4w9WgXcQ' })
    expect(parseWatchUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1')).toEqual({
      site: 'youtube',
      id: 'dQw4w9WgXcQ',
      start: 42,
    })
    expect(parseWatchUrl('youtu.be/dQw4w9WgXcQ')).toEqual({ site: 'youtube', id: 'dQw4w9WgXcQ' })
    expect(parseWatchUrl('https://m.youtube.com/shorts/dQw4w9WgXcQ')).toEqual({ site: 'youtube', id: 'dQw4w9WgXcQ' })
    expect(parseWatchUrl('https://www.youtube.com/live/dQw4w9WgXcQ?feature=share')).toEqual({
      site: 'youtube',
      id: 'dQw4w9WgXcQ',
    })
    expect(parseWatchUrl('https://www.youtube.com/channel/UCabc123')).toEqual({
      site: 'youtube',
      channel: 'UCabc123',
      live: true,
    })
    expect(parseWatchUrl('https://www.twitch.tv/somestreamer')).toEqual({ site: 'twitch', channel: 'somestreamer' })
    expect(parseWatchUrl('twitch.tv/somestreamer?referrer=x')).toEqual({ site: 'twitch', channel: 'somestreamer' })
    expect(parseWatchUrl('https://www.twitch.tv/videos/123456789')).toEqual({ site: 'twitch', video: '123456789' })
    expect(parseWatchUrl('https://www.twitch.tv/somestreamer/video/123456789')).toEqual({
      site: 'twitch',
      video: '123456789',
    })
    expect(parseWatchUrl('https://player.twitch.tv/?channel=abc&parent=x')).toEqual({ site: 'twitch', channel: 'abc' })
  })

  it('says no to anything else', () => {
    expect(parseWatchUrl('')).toBeNull()
    expect(parseWatchUrl('not a link')).toBeNull()
    expect(parseWatchUrl('https://vimeo.com/12345')).toBeNull()
    expect(parseWatchUrl('https://www.youtube.com/')).toBeNull()
    expect(parseWatchUrl('https://www.youtube.com/watch?v=short')).toBeNull()
    expect(parseWatchUrl('https://www.twitch.tv/directory/gaming')).toBeNull()
  })
})

describe('embedUrl', () => {
  it('uses the no-cookie YouTube player and tells Twitch who is embedding', () => {
    expect(embedUrl({ site: 'youtube', id: 'dQw4w9WgXcQ' }, 'x')).toBe(
      'https://www.youtube.com/embed/dQw4w9WgXcQ?playsinline=1&rel=0',
    )
    expect(embedUrl({ site: 'youtube', channel: 'UC1', live: true }, 'x')).toBe(
      'https://www.youtube.com/embed/live_stream?channel=UC1',
    )
    expect(embedUrl({ site: 'twitch', channel: 'abc' }, 'james.github.io')).toBe(
      'https://player.twitch.tv/?channel=abc&parent=james.github.io&autoplay=false',
    )
    expect(embedUrl({ site: 'twitch', video: '9' }, 'localhost')).toBe(
      'https://player.twitch.tv/?video=9&parent=localhost&autoplay=false',
    )
    expect(describeWatchable({ site: 'twitch', channel: 'abc' })).toBe('Twitch · abc')
  })
})

describe('start times', () => {
  it('reads t= in every form the sites use', () => {
    expect(parseStart('354')).toBe(354)
    expect(parseStart('354s')).toBe(354)
    expect(parseStart('5m54s')).toBe(354)
    expect(parseStart('1h2m3s')).toBe(3723)
    expect(parseStart('0')).toBeUndefined()
    expect(parseStart('soon')).toBeUndefined()
    expect(parseStart(null)).toBeUndefined()
  })

  it('starts the player where the link said', () => {
    const yt = parseWatchUrl('https://youtu.be/vQy3QXxwT7g?si=m30f1MYPO5v7Qkbs&t=354')
    expect(yt).toEqual({ site: 'youtube', id: 'vQy3QXxwT7g', start: 354 })
    expect(embedUrl(yt!, 'x')).toBe('https://www.youtube.com/embed/vQy3QXxwT7g?playsinline=1&rel=0&start=354')
    expect(describeWatchable(yt!)).toBe('YouTube · from 5:54')
    expect(parseWatchUrl('https://www.youtube.com/watch?v=vQy3QXxwT7g&t=1m30s')).toMatchObject({ start: 90 })
    const tw = parseWatchUrl('https://www.twitch.tv/videos/123456789?t=1h2m3s')
    expect(embedUrl(tw!, 'h')).toBe('https://player.twitch.tv/?video=123456789&time=1h2m3s&parent=h&autoplay=false')
  })
})
