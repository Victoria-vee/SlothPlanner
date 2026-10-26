// Pure countdown logic for the "Just 5 Minutes" timer. Time is always derived from an end
// timestamp and the current clock, never from a decrementing counter, so a delayed render
// or a throttled background tab cannot make the timer drift.

export const DURATION_MS = 5 * 60 * 1000

// status: idle | running | paused | ready (after reset) | finished
export const initialTimer = { status: 'idle', target: null, endAt: null, remainingMs: DURATION_MS }

export const isActive = (state) =>
  state.status === 'running' || state.status === 'paused' || state.status === 'ready'

export function remainingMs(state, now) {
  if (state.status === 'running') return Math.min(DURATION_MS, Math.max(0, state.endAt - now))
  if (state.status === 'finished') return 0
  return state.remainingMs
}

export function formatClock(ms) {
  const totalSeconds = Math.ceil(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${minutes}:${String(seconds).padStart(2, '0')}`
}

const run = (state, now, ms, target = state.target) => ({
  status: 'running',
  target,
  endAt: now + ms,
  remainingMs: ms,
})

/**
 * Actions: start {target, now} | pause {now} | resume {now} | reset | tick {now} | keepGoing {now} | close.
 * Invalid transitions return the same state, which is what prevents duplicate timers.
 */
export function timerReducer(state, action) {
  switch (action.type) {
    case 'start':
      // A new timer can only begin when none is active.
      if (state.status !== 'idle' && state.status !== 'finished') return state
      return run(state, action.now, DURATION_MS, action.target)
    case 'pause': {
      if (state.status !== 'running') return state
      const left = remainingMs(state, action.now)
      if (left <= 0) return { ...state, status: 'finished', endAt: null, remainingMs: 0 }
      return { ...state, status: 'paused', endAt: null, remainingMs: left }
    }
    case 'resume':
      if (state.status === 'paused') return run(state, action.now, state.remainingMs)
      if (state.status === 'ready') return run(state, action.now, DURATION_MS)
      return state
    case 'reset':
      if (state.status !== 'running' && state.status !== 'paused') return state
      return { ...state, status: 'ready', endAt: null, remainingMs: DURATION_MS }
    case 'tick':
      if (state.status === 'running' && action.now >= state.endAt) {
        return { ...state, status: 'finished', endAt: null, remainingMs: 0 }
      }
      return state
    case 'keepGoing':
      if (state.status !== 'finished') return state
      return run(state, action.now, DURATION_MS)
    case 'close':
      return initialTimer
    default:
      return state
  }
}

export const TIMER_STORAGE_KEY = 'sloth-focus-timer'

const isTarget = (t) =>
  typeof t === 'object' &&
  t !== null &&
  typeof t.taskId === 'string' &&
  typeof t.taskTitle === 'string' &&
  (t.stepId === null || typeof t.stepId === 'string') &&
  (t.stepText === null || typeof t.stepText === 'string')

/** Turns saved JSON text back into a safe timer state, or the idle state if it is missing or invalid. */
export function restoreTimer(raw, now) {
  let saved
  try {
    saved = JSON.parse(raw)
  } catch {
    return initialTimer
  }
  if (typeof saved !== 'object' || saved === null || !isTarget(saved.target)) return initialTimer
  const { status, target } = saved
  if (status === 'running' && Number.isFinite(saved.endAt)) {
    // If the end time passed while the page was closed, it comes back as finished.
    if (now >= saved.endAt) return { status: 'finished', target, endAt: null, remainingMs: 0 }
    return { status, target, endAt: saved.endAt, remainingMs: saved.endAt - now }
  }
  if (status === 'paused' && Number.isFinite(saved.remainingMs)) {
    const left = Math.min(DURATION_MS, Math.max(1, saved.remainingMs))
    return { status, target, endAt: null, remainingMs: left }
  }
  if (status === 'ready') return { status, target, endAt: null, remainingMs: DURATION_MS }
  if (status === 'finished') return { status, target, endAt: null, remainingMs: 0 }
  return initialTimer
}

/** Text to store, or null when there is nothing to keep (idle). */
export function serializeTimer(state) {
  if (state.status === 'idle') return null
  return JSON.stringify({
    status: state.status,
    target: state.target,
    endAt: state.endAt,
    remainingMs: state.remainingMs,
  })
}

export const SOUND_STORAGE_KEY = 'sloth-focus-sound'

// Sound is on unless the user switched it off.
export const parseSoundPref = (raw) => raw !== 'off'

// The chime plays only when a running countdown genuinely reaches zero, never for restored or paused states.
export const shouldPlayCompletionSound = (prev, next) =>
  prev.status === 'running' && next.status === 'finished'

// A timer whose task no longer exists must not linger.
export const isTargetMissing = (target, tasks) => !tasks.some((t) => t.id === target.taskId)

// The storage argument is a localStorage-like object; every call is guarded because storage can throw.
export function loadTimer(storage, now) {
  try {
    return restoreTimer(storage.getItem(TIMER_STORAGE_KEY), now)
  } catch {
    return initialTimer
  }
}

export function saveTimer(storage, state) {
  try {
    const text = serializeTimer(state)
    if (text === null) storage.removeItem(TIMER_STORAGE_KEY)
    else storage.setItem(TIMER_STORAGE_KEY, text)
  } catch {
    // Storage may be full or blocked; the timer still works for this page view.
  }
}

export function loadSoundPref(storage) {
  try {
    return parseSoundPref(storage.getItem(SOUND_STORAGE_KEY))
  } catch {
    return true
  }
}

export function saveSoundPref(storage, on) {
  try {
    storage.setItem(SOUND_STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // Ignore: the preference just will not persist.
  }
}
