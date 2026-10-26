import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowLeft } from '@fortawesome/free-solid-svg-icons'
import { hrefFor } from '../routes.js'

// The suggestions form is rendered into .review-target by BrainDump, which keeps owning its state.
function ReviewPage({ setTarget }) {
  return (
    <div className="review-page">
      <a className="link-arrow" href={hrefFor('dashboard')}>
        <FontAwesomeIcon icon={faArrowLeft} /> Back to dashboard
      </a>
      <h1 className="page-title">Review your tasks</h1>
      <p className="page-subtitle">
        Edit anything, remove what you don&apos;t want, then confirm. Nothing is saved until you do.
      </p>
      <section className="card review-card">
        <div className="review-target" ref={setTarget} />
        <p className="muted state-message review-empty">
          Nothing to review right now. Write a brain dump on the dashboard and choose &quot;Untangle
          my brain&quot;.
        </p>
      </section>
    </div>
  )
}

export default ReviewPage
