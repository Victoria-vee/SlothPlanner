import { useEffect, useRef, useState } from 'react'
import { suggestSteps } from '../api.js'
import { getSteps, mergeSteps, stepProgress, toggleStep } from '../stepUtils.js'
import { useFocusTimer } from '../timerContext.js'
import { isActive } from '../timerCore.js'

// Lazy Mode for one task. All state is local to the task card, so cards never affect each other.
// Suggestions live only in this component until the user accepts them.
function LazyMode({ task, onChange }) {
  const done = task.status === 'completed'
  const steps = getSteps(task)
  const [phase, setPhase] = useState('idle') // idle | loading | review
  const [drafts, setDrafts] = useState([])
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingStep, setPendingStep] = useState(null)
  const busyRef = useRef(false)
  const controllerRef = useRef(null)
  const nextDraftId = useRef(0)
  const panelId = `lazy-${task.id}`
  const { timer, start } = useFocusTimer()
  const timerBusy = timer.status !== 'idle' && timer.status !== 'finished'
  const timerHere = isActive(timer) && timer.target.taskId === task.id
  const startTimer = (step) =>
    start({
      taskId: task.id,
      taskTitle: task.title,
      stepId: step?.id ?? null,
      stepText: step?.text ?? null,
    })

  useEffect(() => () => controllerRef.current?.abort(), [])

  const generate = async () => {
    if (busyRef.current) return
    busyRef.current = true
    const controller = new AbortController()
    controllerRef.current = controller
    setPhase('loading')
    setError('')
    setNotice('')
    try {
      const result = await suggestSteps(
        task,
        steps.map((s) => s.text),
        { signal: controller.signal },
      )
      setDrafts(result.map((s) => ({ ...s, key: nextDraftId.current++ })))
      setPhase('review')
    } catch (err) {
      if (err.name === 'AbortError') return
      setError(err.message)
      setPhase('idle')
    } finally {
      busyRef.current = false
    }
  }

  const discard = () => {
    setDrafts([])
    setPhase('idle')
    setError('')
  }

  const editDraft = (key, text) =>
    setDrafts((list) => list.map((d) => (d.key === key ? { ...d, text } : d)))
  const removeDraft = (key) => setDrafts((list) => list.filter((d) => d.key !== key))

  const accept = async () => {
    if (busyRef.current) return
    const { steps: merged, added, skipped } = mergeSteps(steps, drafts)
    if (added === 0) {
      setError('Nothing new to add. These steps are empty, repeated or over the limit.')
      return
    }
    busyRef.current = true
    setSaving(true)
    setError('')
    try {
      await onChange(task.id, { steps: merged })
      setNotice(
        `Added ${added} ${added === 1 ? 'step' : 'steps'}.` +
          (skipped > 0 ? ` Skipped ${skipped} that were repeated or over the limit.` : ''),
      )
      setDrafts([])
      setPhase('idle')
    } catch (err) {
      // Suggestions stay on screen so a retry does not need another AI request.
      setError(`Could not save the steps: ${err.message}`)
    } finally {
      busyRef.current = false
      setSaving(false)
    }
  }

  const flip = async (id) => {
    if (pendingStep) return
    setPendingStep(id)
    setError('')
    try {
      await onChange(task.id, { steps: toggleStep(steps, id) })
    } catch (err) {
      setError(`Could not update the step: ${err.message}`)
    } finally {
      setPendingStep(null)
    }
  }

  const progress = stepProgress(steps)
  const loading = phase === 'loading'

  return (
    <div className="lazy">
      {steps.length > 0 && (
        <details className="lazy-steps" open={!done}>
          <summary>
            Steps: {progress.done} of {progress.total} done
          </summary>
          <ul className="lazy-step-list">
            {steps.map((step) => (
              <li key={step.id} className={step.done ? 'is-done' : undefined}>
                <label>
                  <input
                    type="checkbox"
                    checked={step.done}
                    disabled={pendingStep !== null}
                    onChange={() => flip(step.id)}
                  />
                  <span>
                    {step.text}
                    {step.estimatedMinutes && (
                      <span className="lazy-minutes"> (about {step.estimatedMinutes} min)</span>
                    )}
                  </span>
                </label>
                {!step.done && !done && (
                  <button
                    type="button"
                    className="link-button lazy-step-timer"
                    onClick={() => startTimer(step)}
                    disabled={timerBusy}
                    aria-label={`Start a 5-minute timer for: ${step.text}`}
                  >
                    5 min
                  </button>
                )}
              </li>
            ))}
          </ul>
          {progress.total > 0 && progress.done === progress.total && !done && (
            <p className="lazy-note">
              All steps are checked. Mark the task complete above when you are ready.
            </p>
          )}
        </details>
      )}

      <div className="timer-make-easy">
        {!done && (
          <div className="lazy-timer-row">
            <button
              type="button"
              className="link-button lazy-button"
              onClick={() => startTimer(null)}
              disabled={timerBusy}
              aria-label={`Just 5 minutes on: ${task.title}`}
            >
              Just 5 minutes
            </button>
            {timerBusy && (
              <span className="muted lazy-timer-hint">
                {timerHere
                  ? 'Timer is running for this task (see the top of the page).'
                  : `A timer is already running for "${timer.target.taskTitle}".`}
              </span>
            )}
          </div>
        )}
        {!done && phase !== 'review' && (
          <button
            type="button"
            className="link-button lazy-button"
            onClick={generate}
            disabled={loading || saving}
            aria-busy={loading}
            aria-controls={panelId}
          >
            {loading
              ? 'Finding small steps…'
              : steps.length > 0
                ? 'Add more small steps'
                : 'Make this easier'}
          </button>
        )}
      </div>

      <div id={panelId} aria-live="polite">
        {notice && <p className="lazy-note">{notice}</p>}
        {error && (
          <p role="alert" className="task-error">
            {error}{' '}
            {phase === 'idle' && !done && (
              <button type="button" className="link-button" onClick={generate} disabled={loading}>
                Try again
              </button>
            )}
          </p>
        )}

        {phase === 'review' && !done && (
          <div className="lazy-panel">
            <p className="lazy-title">A gentler way in</p>
            <p className="muted lazy-help">
              Suggestions only. Edit or remove anything, then keep the ones you like. Time
              estimates are rough guesses.
            </p>
            {drafts.length === 0 ? (
              <p className="muted">No steps left. You can discard this or ask again.</p>
            ) : (
              <ol className="lazy-draft-list">
                {drafts.map((draft, index) => (
                  <li key={draft.key}>
                    <input
                      type="text"
                      value={draft.text}
                      maxLength={200}
                      disabled={saving}
                      onChange={(e) => editDraft(draft.key, e.target.value)}
                      aria-label={`Step ${index + 1}`}
                    />
                    {draft.minutes && <span className="lazy-minutes">~{draft.minutes} min</span>}
                    <button
                      type="button"
                      className="link-button"
                      disabled={saving}
                      onClick={() => removeDraft(draft.key)}
                      aria-label={`Remove step ${index + 1}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ol>
            )}
            <div className="lazy-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={accept}
                disabled={saving || drafts.length === 0}
              >
                {saving ? 'Saving…' : 'Keep these steps'}
              </button>
              <button type="button" className="btn-secondary" onClick={discard} disabled={saving}>
                Discard
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default LazyMode
