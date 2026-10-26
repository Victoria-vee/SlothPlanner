import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { brainDump } from '../api.js'
import SuggestionReview from './SuggestionReview.jsx'
import { hrefFor } from '../routes.js'

function BrainDump({ onAddTask, reviewTarget }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [suggestions, setSuggestions] = useState(null)
  const [runKey, setRunKey] = useState(0)
  const controllerRef = useRef(null)

  useEffect(() => () => controllerRef.current?.abort(), [])

  const reviewing = suggestions !== null && suggestions.length > 0

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (loading || reviewing) return
    if (!text.trim()) {
      setError('Write something first. Messy is fine.')
      return
    }

    const controller = new AbortController()
    controllerRef.current = controller
    setLoading(true)
    setError('')
    setNotice('')
    try {
      const result = await brainDump(text, { signal: controller.signal })
      if (result.length === 0) {
        setNotice("I couldn't find any tasks in that. Try adding a bit more detail.")
      } else {
        setSuggestions(result)
        setRunKey((key) => key + 1)
        window.location.hash = hrefFor('review')
      }
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message)
    } finally {
      if (controllerRef.current === controller) setLoading(false)
    }
  }

  const handleFinished = ({ saved, complete }) => {
    setSuggestions(null)
    window.location.hash = hrefFor('dashboard')
    if (saved > 0 && complete) {
      setText('')
      setNotice(`Saved ${saved} ${saved === 1 ? 'task' : 'tasks'} to your list.`)
    } else if (complete && saved === 0) {
      setNotice('')
    } else {
      setNotice('Suggestions discarded. Your text is still here if you want to try again.')
    }
  }

  return (
    <section className="card brain-dump" aria-labelledby="brain-dump-heading">
      <h2 id="brain-dump-heading">Brain dump</h2>
      <p id="brain-dump-help" className="muted">
        Write as messily as you like: tasks, reminders, deadlines, half-thoughts, all in one go.
        No need to organise anything first. AI suggests tasks and you decide which to keep.
      </p>
      <form onSubmit={handleSubmit} aria-busy={loading}>
        <label htmlFor="brain-dump-input" className="visually-hidden">
          Your thoughts, in any order
        </label>
        <textarea
          id="brain-dump-input"
          className="brain-dump-input"
          rows={9}
          maxLength={8000}
          value={text}
          readOnly={loading}
          onChange={(e) => setText(e.target.value)}
          aria-describedby="brain-dump-help"
          placeholder="I need to send that invoice today, reply to Sam about the venue, and renew my passport before the end of the month…"
        />
        <div className="form-actions">
          <button type="submit" className="btn-primary" disabled={loading || reviewing}>
            {loading ? 'Untangling…' : 'Untangle my brain'}
          </button>
          <p role="status" className="muted form-message">
            {loading && 'Reading your brain dump. This can take a few seconds…'}
            {!loading && reviewing && 'Your suggestions are waiting on the review page.'}
            {!loading && !reviewing && notice}
          </p>
        </div>
        {error && (
          <p role="alert" className="form-error brain-dump-error">
            {error}
          </p>
        )}
      </form>

      {reviewing &&
        reviewTarget &&
        createPortal(
          <SuggestionReview
            key={runKey}
            suggestions={suggestions}
            onAddTask={onAddTask}
            onFinished={handleFinished}
          />,
          reviewTarget,
        )}
    </section>
  )
}

export default BrainDump
