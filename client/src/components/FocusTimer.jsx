import { useEffect, useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import {
  faPause,
  faPlay,
  faRotateLeft,
  faVolumeHigh,
  faVolumeXmark,
  faXmark,
} from '@fortawesome/free-solid-svg-icons'
import { useFocusTimer } from '../timerContext.js'
import { DURATION_MS, formatClock } from '../timerCore.js'

// The single visible timer. It always names the task (and step) it belongs to.
function FocusTimer() {
  const { timer, remaining, soundOn, setSoundOn, pause, resume, reset, keepGoing, close } =
    useFocusTimer()
  const { status, target } = timer
  const headingRef = useRef(null)

  // Move focus to the message when the countdown ends so keyboard and screen reader users notice it.
  useEffect(() => {
    if (status === 'finished') headingRef.current?.focus()
  }, [status])

  if (status === 'idle') return null

  const finished = status === 'finished'
  const progress = Math.round(((DURATION_MS - remaining) / DURATION_MS) * 100)
  const what = target.stepText ? `${target.stepText} (${target.taskTitle})` : target.taskTitle

  return (
    <section className={`focus-timer focus-${status}`} aria-label="Just 5 minutes timer">
      <div className="focus-head">
        <p className="focus-for">
          <span className="focus-label">Just 5 minutes</span>
          <span className="visually-hidden">Timer for: </span>
          <strong>{what}</strong>
        </p>
        <button
          type="button"
          className="btn-icon"
          onClick={() => setSoundOn(!soundOn)}
          aria-pressed={soundOn}
          aria-label={soundOn ? 'Completion sound on. Turn off' : 'Completion sound off. Turn on'}
          title={soundOn ? 'Sound on' : 'Sound off'}
        >
          <FontAwesomeIcon icon={soundOn ? faVolumeHigh : faVolumeXmark} fixedWidth />
        </button>
      </div>

      {finished ? (
        <div className="focus-done" role="status">
          <p className="focus-message" tabIndex={-1} ref={headingRef}>
            You showed up. That&apos;s a win.
          </p>
          <p className="muted">Nothing was marked complete. That is still up to you.</p>
          <div className="focus-actions">
            <button type="button" className="btn-primary" onClick={keepGoing}>
              Keep going
            </button>
            <button type="button" className="btn-secondary" onClick={close}>
              I&apos;m done for now
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="focus-clock-row">
            <span className="focus-clock" role="timer" aria-live="off">
              <span className="visually-hidden">Time left: </span>
              {formatClock(remaining)}
            </span>
            <span className="focus-state muted" role="status">
              {status === 'paused' && 'Paused'}
              {status === 'ready' && 'Reset. Ready when you are.'}
              {status === 'running' && 'Just five minutes. That is all.'}
            </span>
          </div>
          <div className="focus-bar" aria-hidden="true">
            <div className="focus-bar-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="focus-controls">
            <div className="focus-controls-main">
              {status === 'running' ? (
                <button type="button" className="btn-secondary" onClick={pause}>
                  <FontAwesomeIcon icon={faPause} /> Pause
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={resume}>
                  <FontAwesomeIcon icon={faPlay} /> {status === 'ready' ? 'Start' : 'Resume'}
                </button>
              )}
              <button
                type="button"
                className="btn-secondary"
                onClick={reset}
                disabled={status === 'ready'}
              >
                <FontAwesomeIcon icon={faRotateLeft} /> Reset
              </button>
            </div>
            <button type="button" className="btn-danger-outline" onClick={close}>
              <FontAwesomeIcon icon={faXmark} /> Cancel timer
            </button>
          </div>        </>
      )}
    </section>
  )
}

export default FocusTimer
