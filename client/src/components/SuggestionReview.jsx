import { useRef, useState } from 'react'

let nextId = 1

function toReviewItems(suggestions) {
  return suggestions.map((s) => ({
    id: nextId++,
    title: s.title,
    description: s.description || '',
    priority: s.priority || '',
    dueDate: s.dueDate || '',
    estimatedMinutes: s.estimatedMinutes ?? '',
    approved: true,
    error: '',
  }))
}

// A date without a time is treated as the end of that day in the user's local time zone.
function endOfLocalDay(dateString) {
  const [y, m, d] = dateString.split('-').map(Number)
  return new Date(y, m - 1, d, 23, 59, 0).toISOString()
}

// Returns { payload } or { error } for one review row. Unset fields are omitted so the backend defaults apply.
function buildPayload(item) {
  const title = item.title.trim()
  if (!title) return { error: 'Give this task a title or remove it.' }

  const payload = {
    title,
    description: item.description.trim(),
    metadata: { source: 'brain-dump' },
  }
  if (item.priority) payload.priority = item.priority
  if (item.dueDate) payload.dueDate = endOfLocalDay(item.dueDate)
  if (item.estimatedMinutes !== '') {
    const minutes = Number(item.estimatedMinutes)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 10080) {
      return { error: 'Duration must be a whole number of minutes from 1 to 10080.' }
    }
    payload.estimatedMinutes = minutes
  }
  return { payload }
}

function SuggestionReview({ suggestions, onAddTask, onFinished }) {
  const [items, setItems] = useState(() => toReviewItems(suggestions))
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState('')
  const savingRef = useRef(false)

  const update = (id, changes) =>
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...changes } : item)))

  const remove = (id) => setItems((current) => current.filter((item) => item.id !== id))

  const approvedCount = items.filter((item) => item.approved).length

  const handleSave = async () => {
    // The ref blocks a second click before React re-renders the disabled button.
    if (savingRef.current) return
    savingRef.current = true
    setSaving(true)
    setNotice('')

    let saved = 0
    let failed = 0
    for (const item of items.filter((i) => i.approved)) {
      const { payload, error } = buildPayload(item)
      if (error) {
        update(item.id, { error })
        failed += 1
        continue
      }
      try {
        await onAddTask(payload)
        saved += 1
        remove(item.id)
      } catch (err) {
        update(item.id, { error: `Not saved: ${err.message}` })
        failed += 1
      }
    }

    savingRef.current = false
    setSaving(false)

    if (failed === 0) {
      onFinished({ saved, complete: true })
    } else {
      setNotice(
        `${saved} saved, ${failed} not saved. The tasks that failed are still below so you can fix or retry them.`,
      )
    }
  }

  if (items.length === 0) {
    return (
      <div className="review">
        <p className="muted state-message" role="status">
          Nothing left to review.
        </p>
        <button type="button" className="btn-secondary" onClick={() => onFinished({ saved: 0, complete: true })}>
          Done
        </button>
      </div>
    )
  }

  return (
    <div className="review">
      <h3 id="review-heading">Review suggested tasks</h3>
      <p className="muted">
        Suggested by AI from your text. Nothing is saved until you approve it. Blank fields mean the AI
        found nothing in your text to fill them with.
      </p>
      <ul className="review-list" aria-labelledby="review-heading">
        {items.map((item, index) => {
          const n = index + 1
          return (
            <li key={item.id} className={`review-item${item.approved ? '' : ' is-skipped'}`}>
              <div className="review-top">
                <label className="review-approve">
                  <input
                    type="checkbox"
                    checked={item.approved}
                    disabled={saving}
                    onChange={(e) => update(item.id, { approved: e.target.checked })}
                  />
                  Keep
                </label>
                <button
                  type="button"
                  className="link-button"
                  disabled={saving}
                  onClick={() => remove(item.id)}
                  aria-label={`Remove suggestion ${n}`}
                >
                  Remove
                </button>
              </div>

              <label className="review-field" htmlFor={`rt-${item.id}`}>
                Title
              </label>
              <input
                id={`rt-${item.id}`}
                type="text"
                className="review-input"
                maxLength={200}
                value={item.title}
                disabled={saving}
                onChange={(e) => update(item.id, { title: e.target.value, error: '' })}
              />

              <label className="review-field" htmlFor={`rn-${item.id}`}>
                Notes
              </label>
              <textarea
                id={`rn-${item.id}`}
                className="review-input"
                rows={2}
                maxLength={5000}
                value={item.description}
                disabled={saving}
                onChange={(e) => update(item.id, { description: e.target.value })}
              />

              <div className="review-row">
                <div>
                  <label className="review-field" htmlFor={`rd-${item.id}`}>
                    Due date
                  </label>
                  <input
                    id={`rd-${item.id}`}
                    type="date"
                    className="review-input"
                    value={item.dueDate}
                    disabled={saving}
                    onChange={(e) => update(item.id, { dueDate: e.target.value })}
                  />
                </div>
                <div>
                  <label className="review-field" htmlFor={`rp-${item.id}`}>
                    Priority
                  </label>
                  <select
                    id={`rp-${item.id}`}
                    className="review-input"
                    value={item.priority}
                    disabled={saving}
                    onChange={(e) => update(item.id, { priority: e.target.value })}
                  >
                    <option value="">Not set</option>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label className="review-field" htmlFor={`rm-${item.id}`}>
                    Minutes
                  </label>
                  <input
                    id={`rm-${item.id}`}
                    type="number"
                    min="1"
                    max="10080"
                    className="review-input"
                    value={item.estimatedMinutes}
                    disabled={saving}
                    onChange={(e) => update(item.id, { estimatedMinutes: e.target.value })}
                  />
                </div>
              </div>

              {item.error && (
                <p role="alert" className="form-error review-error">
                  {item.error}
                </p>
              )}
            </li>
          )
        })}
      </ul>

      <div className="form-actions">
        <button
          type="button"
          className="btn-primary"
          disabled={saving || approvedCount === 0}
          onClick={handleSave}
        >
          {saving ? 'Saving…' : `Save ${approvedCount} ${approvedCount === 1 ? 'task' : 'tasks'}`}
        </button>
        <button
          type="button"
          className="btn-secondary"
          disabled={saving}
          onClick={() => onFinished({ saved: 0, complete: false })}
        >
          Discard all
        </button>
        <p role="status" className="form-message muted">
          {notice || 'Tasks without a priority are saved as Medium.'}
        </p>
      </div>
    </div>
  )
}

export default SuggestionReview
