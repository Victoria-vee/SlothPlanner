import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { TimerContext } from '../timerContext.js'
import {
  loadSoundPref,
  loadTimer,
  remainingMs,
  saveSoundPref,
  saveTimer,
  shouldPlayCompletionSound,
  timerReducer,
} from '../timerCore.js'
import { playChime, primeAudio } from '../sound.js'

// One shared timer for the whole app, so two timers can never run at once. It is restored from
// localStorage on load and saved only when the timer changes state (never on a countdown tick).
// A running timer is stored as an absolute end time, so it keeps elapsing while the page is closed.
function TimerProvider({ children }) {
  const [state, dispatch] = useReducer(timerReducer, undefined, () =>
    loadTimer(window.localStorage, Date.now()),
  )
  const [now, setNow] = useState(() => Date.now())
  const [soundOn, setSoundOnState] = useState(() => loadSoundPref(window.localStorage))
  const previous = useRef(state)

  // Saves on state transitions only: the reducer returns the same object for ticks that change nothing.
  useEffect(() => {
    saveTimer(window.localStorage, state)
  }, [state])

  // The interval exists only while running and is cleared on pause, finish or unmount.
  useEffect(() => {
    if (state.status !== 'running') return undefined
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      dispatch({ type: 'tick', now: t })
    }, 250)
    return () => clearInterval(id)
  }, [state.status, state.endAt])

  // Browsers slow timers in hidden tabs, so re-check the clock as soon as the tab is visible again.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== 'visible') return
      const t = Date.now()
      setNow(t)
      dispatch({ type: 'tick', now: t })
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // Plays the chime once per genuine running -> finished transition. The previous state starts as
  // the restored state, so reopening the page on an already finished timer stays silent, and a
  // repeated effect run (Strict Mode) compares a state with itself and does nothing.
  useEffect(() => {
    const before = previous.current
    previous.current = state
    if (before !== state && soundOn && shouldPlayCompletionSound(before, state)) {
      playChime()
    }
  }, [state, soundOn])

  const send = useCallback((action) => {
    const t = Date.now()
    setNow(t)
    dispatch({ ...action, now: t })
  }, [])

  const setSoundOn = useCallback((on) => {
    setSoundOnState(on)
    saveSoundPref(window.localStorage, on)
    if (on) primeAudio()
  }, [])

  const value = useMemo(
    () => ({
      timer: state,
      remaining: remainingMs(state, now),
      soundOn,
      setSoundOn,
      start: (target) => {
        primeAudio() // a click is the moment browsers allow audio to be unlocked
        send({ type: 'start', target })
      },
      pause: () => send({ type: 'pause' }),
      resume: () => {
        primeAudio()
        send({ type: 'resume' })
      },
      reset: () => send({ type: 'reset' }),
      keepGoing: () => {
        primeAudio()
        send({ type: 'keepGoing' })
      },
      close: () => send({ type: 'close' }),
    }),
    [state, now, soundOn, setSoundOn, send],
  )

  return <TimerContext.Provider value={value}>{children}</TimerContext.Provider>
}

export default TimerProvider
