// Keeps the screen on while timers are running. A home-screen web app can't
// make sound once the phone locks, so the best defence is not letting it lock.

let wanted = false
let sentinel: WakeLockSentinel | null = null

async function acquire(): Promise<void> {
  if (!wanted || sentinel || !('wakeLock' in navigator) || document.visibilityState !== 'visible') return
  try {
    const lock = await navigator.wakeLock.request('screen')
    lock.addEventListener('release', () => {
      if (sentinel === lock) sentinel = null
    })
    sentinel = lock
    if (!wanted) release()
  } catch {
    /* denied (e.g. low battery); nothing useful to do */
  }
}

function release(): void {
  sentinel?.release().catch(() => {})
  sentinel = null
}

export function setWakeLock(on: boolean): void {
  if (on === wanted) return
  wanted = on
  if (on) void acquire()
  else release()
}

export function installWakeLock(): void {
  // The browser drops the lock whenever the page is hidden; take it back on return.
  document.addEventListener('visibilitychange', () => void acquire())
}
