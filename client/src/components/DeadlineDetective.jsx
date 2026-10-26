import { useEffect, useState } from 'react'
import { taskBadges } from '../badges.js'
import { explainFlag, formatDue, groupDeadlines, suggestActions } from '../taskUtils.js'

// Re-evaluates deadlines every minute so flags stay accurate while the page is open.
function useNow() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

const STATUS_LABELS = { overdue: 'Overdue', soon: 'Due soon', none: 'No deadline' }

// One card design for every group. The status badge comes from the group the task was placed in,
// and priority is a separate badge, so a priority label can never stand in for deadline status.
function FlaggedTask({ task, now, tone }) {
  const tips = suggestActions(task, now)
  const { priority } = taskBadges(task, now)
  const why = explainFlag(task, now)
  return (
    <li className={`flag flag-${tone}`}>
      <div className="flag-head">
        <p className="risk-title">{task.title}</p>
        <div className="flag-badges">
          <span className={`badge badge-status badge-${tone}`}>{STATUS_LABELS[tone]}</span>
          {priority && (
            <span className={`badge badge-priority badge-${priority.value}`}>
              {priority.label}
            </span>
          )}
        </div>
      </div>
      <p className="risk-meta">
        <span className="visually-hidden">Deadline: </span>
        {tone === 'none' ? 'No deadline set' : formatDue(task.dueDate)}
        {task.status === 'in_progress' && ' · In progress'}
      </p>
      {why && <p className="flag-why">{why}</p>}
      {tips.length > 0 && (
        <details className="flag-tips">
          <summary>Suggestions</summary>
          <ul>
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
        </details>
      )}
    </li>
  )
}
function DeadlineDetective({ tasks, status, error, onRetry }) {
  const now = useNow()
  const { overdue, dueSoon, noDeadline } = groupDeadlines(tasks, now)
  const flagged = overdue.length + dueSoon.length

  return (
    <section
      id="deadline-detective"
      className="card detective"
      aria-labelledby="detective-heading"
    >
      <h2 id="detective-heading">Deadline Detective</h2>
      <p className="muted">
        Open tasks that are overdue or due within the next 24 hours. Suggestions only; nothing
        changes unless you change it.
      </p>

      {status === 'loading' && (
        <p className="muted state-message" role="status">
          Checking your deadlines…
        </p>
      )}

      {status === 'error' && (
        <div className="state-message" role="alert">
          <p className="form-error">Could not check deadlines: {error}</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && (
        <>
          {flagged === 0 && (
            <p className="muted state-message">
              {tasks.length === 0
                ? 'No tasks yet, so nothing to investigate.'
                : 'Nothing overdue or due in the next 24 hours. Carry on napping.'}
            </p>
          )}

          {overdue.length > 0 && (
            <div className="flag-group">
              <h3>Overdue ({overdue.length})</h3>
              <ul className="flag-list">
                {overdue.map((task) => (
                  <FlaggedTask key={task.id} task={task} now={now} tone="overdue" />
                ))}
              </ul>
            </div>
          )}

          {dueSoon.length > 0 && (
            <div className="flag-group">
              <h3>Due soon ({dueSoon.length})</h3>
              <ul className="flag-list">
                {dueSoon.map((task) => (
                  <FlaggedTask key={task.id} task={task} now={now} tone="soon" />
                ))}
              </ul>
            </div>
          )}

          {noDeadline.length > 0 && (
            <div className="flag-group">
              <h3>No deadline ({noDeadline.length})</h3>
              <p className="muted">
                These open tasks have no deadline, so they are not counted as overdue or at risk.
                You can add one if it matters.
              </p>
              <ul className="flag-list">
                {noDeadline.map((task) => (
                  <FlaggedTask key={task.id} task={task} now={now} tone="none" />
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}

export default DeadlineDetective
