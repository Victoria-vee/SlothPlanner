import { useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation } from '@fortawesome/free-solid-svg-icons'
import { formatDue, isAtRisk } from '../taskUtils.js'
import { taskBadges } from '../badges.js'
import LazyMode from './LazyMode.jsx'

function TaskItem({ task, onChange, onDelete }) {
  const done = task.status === 'completed'
  const atRisk = isAtRisk(task)
  const badges = taskBadges(task, new Date())
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState('')

  const run = async (action) => {
    setBusy(true)
    setError('')
    try {
      await action()
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const toggle = () => run(() => onChange(task.id, { status: done ? 'pending' : 'completed' }))
  const remove = () => run(() => onDelete(task.id))

  return (
    <li className={`task-item${done ? ' is-done' : ''}`}>
      <input
        type="checkbox"
        className="task-check"
        checked={done}
        disabled={busy}
        onChange={toggle}
        aria-label={done ? `Reopen: ${task.title}` : `Mark complete: ${task.title}`}
      />
      <div className="task-main">
        <span className="task-title">{task.title}</span>
        {task.description && <span className="task-notes">{task.description}</span>}
        <span className={`deadline${atRisk ? ' deadline-risk' : ''}`}>
          {atRisk && <FontAwesomeIcon icon={faTriangleExclamation} aria-hidden="true" />}{' '}
          <span className="visually-hidden">Deadline: </span>
          {formatDue(task.dueDate)}
          {atRisk && <span className="visually-hidden"> (at risk)</span>}
          {task.status === 'in_progress' && ' · In progress'}
        </span>
        {error && (
          <span role="alert" className="task-error">
            {error}
          </span>
        )}
        <LazyMode task={task} onChange={onChange} />
      </div>
      <div className="task-side">
        {badges.deadline && (
          <span className={`badge badge-status badge-${badges.deadline.tone}`}>{badges.deadline.label}</span>
        )}
        {badges.priority && (
          <span className={`badge badge-priority badge-${badges.priority.value}`}>{badges.priority.label}</span>
        )}
        {confirming ? (
          <span className="confirm">
            <button type="button" className="link-danger" onClick={remove} disabled={busy}>
              {busy ? 'Deleting…' : 'Confirm delete'}
            </button>
            <button
              type="button"
              className="link-danger"
              onClick={() => setConfirming(false)}
              disabled={busy}
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            className="link-danger"
            onClick={() => setConfirming(true)}
            disabled={busy}
            aria-label={`Delete: ${task.title}`}
          >
            Delete
          </button>
        )}
      </div>
    </li>
  )
}

export default TaskItem
