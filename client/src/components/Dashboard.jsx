import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faArrowRight } from '@fortawesome/free-solid-svg-icons'
import BrainDump from './BrainDump.jsx'
import TaskOverview from './TaskOverview.jsx'
import { explainFlag, formatDue, groupDeadlines } from '../taskUtils.js'
import { hrefFor } from '../routes.js'

const PREVIEW_COUNT = 3

// A small look at what needs attention. The full analysis lives in the Workspace.
function UrgentPreview({ tasks, ready }) {
  const now = new Date()
  const { overdue, dueSoon } = groupDeadlines(tasks, now)
  const flagged = [...overdue, ...dueSoon]
  const shown = flagged.slice(0, PREVIEW_COUNT)

  return (
    <section className="card" aria-labelledby="urgent-heading">
      <h2 id="urgent-heading">Needs attention</h2>
      {!ready && <p className="muted state-message">Checking your deadlines…</p>}
      {ready && shown.length === 0 && (
        <p className="muted state-message">Nothing overdue or due in the next 24 hours.</p>
      )}
      {shown.length > 0 && (
        <ul className="urgent-list">
          {shown.map((task) => (
            <li key={task.id}>
              <span className="task-title">{task.title}</span>
              <span className="muted">
                {formatDue(task.dueDate)} · {explainFlag(task, now)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {flagged.length > shown.length && (
        <p className="muted">+{flagged.length - shown.length} more in Deadline Detective.</p>
      )}
      <a className="link-arrow" href={hrefFor('deadlines')}>
        Open Deadline Detective <FontAwesomeIcon icon={faArrowRight} />
      </a>
    </section>
  )
}

function Dashboard({ tasks, status, onAddTask, reviewTarget }) {
  const ready = status === 'ready'
  return (
    <div className="dashboard">
      <header className="page-header">
        <p className="eyebrow">Welcome to BrainDump</p>
        <h1>Get everything out of your head first.</h1>
        <p className="page-subtitle">BrainDump helps you sort it out afterwards.</p>
      </header>

      <TaskOverview tasks={tasks} ready={ready} />

      <div className="dashboard-main">
        <BrainDump onAddTask={onAddTask} reviewTarget={reviewTarget} />
        <UrgentPreview tasks={tasks} ready={ready} />
      </div>
    </div>
  )
}

export default Dashboard