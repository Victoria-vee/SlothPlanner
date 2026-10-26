import { useEffect, useMemo, useState } from 'react'
import { formatDue } from '../taskUtils.js'
import {
  formatMinutes,
  normalizeBudget,
  planDay,
  summarizePlan,
} from '../dailyPlan.js'

const BUDGET_OPTIONS = [
  { value: '', label: 'No limit' },
  { value: '30', label: '30 minutes' },
  { value: '60', label: '1 hour' },
  { value: '120', label: '2 hours' },
  { value: '180', label: '3 hours' },
  { value: '240', label: '4 hours' },
  { value: '360', label: '6 hours' },
]

const localDateKey = () => {
  const d = new Date()
  return `sloth-plan-${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

// The plan only lives in this browser, for the current local day. Nothing is sent to the server.
function loadSaved(key) {
  try {
    const saved = JSON.parse(localStorage.getItem(key))
    if (saved && Array.isArray(saved.accepted) && Array.isArray(saved.dismissed)) return saved
  } catch {
    // Unreadable or unavailable storage just means a fresh plan.
  }
  return { accepted: [], dismissed: [], budget: '' }
}

function fitMessage(summary) {
  if (summary.fit === 'over') {
    return `That is ${formatMinutes(summary.overBy)} more than your time. You don't have to do it all.`
  }
  if (summary.fit === 'uncertain') {
    return 'Fits your time so far, but some tasks have no estimate, so this is not certain.'
  }
  if (summary.fit === 'within') return 'Fits within your time.'
  return ''
}

function DailyPlan({ tasks, status, error, onRetry }) {
  const [storageKey] = useState(localDateKey)
  const [saved] = useState(() => loadSaved(storageKey))
  const [budget, setBudget] = useState(saved.budget)
  const [accepted, setAccepted] = useState(saved.accepted)
  const [dismissed, setDismissed] = useState(saved.dismissed)
  // Set when the user asks for suggestions; changing it again re-runs the selection with a fresh clock.
  const [generated, setGenerated] = useState(null)

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify({ accepted, dismissed, budget }))
    } catch {
      // Storage may be unavailable; the plan then lasts until the page closes.
    }
  }, [storageKey, accepted, dismissed, budget])

  const byId = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const planTasks = accepted
    .map((id) => byId.get(id))
    .filter((t) => t && t.status !== 'completed')
  const summary = summarizePlan(planTasks, budget)

  const budgetMinutes = normalizeBudget(budget)
  const remaining = budgetMinutes === null ? null : budgetMinutes - summary.knownMinutes
  const result = useMemo(() => {
    if (!generated || status !== 'ready') return null
    if (remaining !== null && remaining <= 0) return { suggestions: [], notFit: [], notes: [], full: true }
    return planDay(tasks, {
      budgetMinutes: remaining,
      excludeIds: [...accepted, ...dismissed],
      now: generated.at,
    })
  }, [generated, status, tasks, remaining, accepted, dismissed])

  const generate = () => setGenerated({ at: new Date() })
  const accept = (id) => setAccepted((ids) => (ids.includes(id) ? ids : [...ids, id]))
  const dismiss = (id) => setDismissed((ids) => (ids.includes(id) ? ids : [...ids, id]))
  const unplan = (id) => setAccepted((ids) => ids.filter((x) => x !== id))
  const bringBack = () => setDismissed([])

  const openCount = tasks.filter((t) => t.status !== 'completed').length

  return (
    <section id="plan-my-day" className="card daily-plan" aria-labelledby="plan-heading">
      <h2 id="plan-heading">Plan my day</h2>
      <p className="muted">
        A short list of tasks worth considering today, picked from your saved tasks. You choose
        what goes in; nothing changes unless you change it, and you don't need to finish it all.
      </p>

      {status === 'loading' && (
        <p className="muted state-message" role="status">
          Loading your tasks…
        </p>
      )}

      {status === 'error' && (
        <div className="state-message" role="alert">
          <p className="form-error">Could not load tasks to plan with: {error}</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && openCount === 0 && planTasks.length === 0 && (
        <p className="muted state-message">
          No open tasks to plan. Enjoy the quiet, or untangle your brain above.
        </p>
      )}

      {status === 'ready' && (openCount > 0 || planTasks.length > 0) && (
        <>
          <div className="plan-controls">
            <label className="plan-budget">
              <span>Time available today </span>
              <select value={budget} onChange={(e) => setBudget(e.target.value)}>
                {BUDGET_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="btn-primary" onClick={generate}>
              {generated ? 'Reconsider' : 'Plan My Day'}
            </button>
          </div>

          {planTasks.length > 0 && (
            <div className="plan-group">
              <h3>Today's plan ({planTasks.length})</h3>
              <ul className="plan-list">
                {planTasks.map((task) => (
                  <li key={task.id} className="plan-item">
                    <div className="plan-main">
                      <span className="task-title">{task.title}</span>
                      <span className="muted plan-meta">
                        {formatDue(task.dueDate)}
                        {' · '}
                        {Number.isInteger(task.estimatedMinutes)
                          ? formatMinutes(task.estimatedMinutes)
                          : 'no estimate'}
                      </span>
                    </div>
                    <button
                      type="button"
                      className="link-button"
                      onClick={() => unplan(task.id)}
                      aria-label={`Remove from today's plan: ${task.title}`}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <p className="plan-summary" role="status">
                {summary.knownMinutes > 0
                  ? `About ${formatMinutes(summary.knownMinutes)} of estimated work`
                  : 'No time estimates yet'}
                {summary.unknownCount > 0 &&
                  ` · ${summary.unknownCount} ${summary.unknownCount === 1 ? 'task has' : 'tasks have'} no estimate`}
                .{' '}
                {fitMessage(summary)}
              </p>
            </div>
          )}

          {result && (
            <div className="plan-group">
              <h3>Suggestions</h3>
              {result.full && (
                <p className="muted">Your plan already fills the time you have. Nicely done.</p>
              )}
              {!result.full && result.suggestions.length === 0 && result.notFit.length === 0 && (
                <p className="muted">
                  No more suggestions right now. Everything else is either planned, dismissed or
                  not a good fit today.
                </p>
              )}
              {result.notes.map((note) => (
                <p key={note} className="plan-note">
                  {note}
                </p>
              ))}
              {result.suggestions.length > 0 && (
                <ul className="plan-list">
                  {result.suggestions.map((s) => (
                    <li key={s.task.id} className={`plan-item plan-suggestion tier-${s.tier}`}>
                      <div className="plan-main">
                        <span className="task-title">{s.task.title}</span>
                        <span className="plan-why">{s.reasons.join(' ')}</span>
                        {s.exceedsBudget && (
                          <span className="plan-note">Longer than your available time.</span>
                        )}
                      </div>
                      <div className="plan-actions">
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => accept(s.task.id)}
                          aria-label={`Add to today's plan: ${s.task.title}`}
                        >
                          Add to today
                        </button>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => dismiss(s.task.id)}
                          aria-label={`Not today: ${s.task.title}`}
                        >
                          Not today
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {result.notFit.length > 0 && (
                <div className="plan-group">
                  <h4>Urgent, but doesn't fit your time</h4>
                  <ul className="nodeadline-list">
                    {result.notFit.map((n) => (
                      <li key={n.task.id}>
                        {n.task.title} ({formatMinutes(n.minutes)}): {n.reasons[0]}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {dismissed.length > 0 && (
            <button type="button" className="link-button" onClick={bringBack}>
              Bring back {dismissed.length} dismissed {dismissed.length === 1 ? 'suggestion' : 'suggestions'}
            </button>
          )}
        </>
      )}
    </section>
  )
}

export default DailyPlan
