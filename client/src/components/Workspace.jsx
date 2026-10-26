import { useRef } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faCalendarCheck, faClock, faListCheck } from '@fortawesome/free-solid-svg-icons'
import TaskList from './TaskList.jsx'
import DailyPlan from './DailyPlan.jsx'
import DeadlineDetective from './DeadlineDetective.jsx'
import { TABS, hrefFor, nextTab } from '../routes.js'

const TAB_META = {
  tasks: { label: 'My Tasks', icon: faListCheck },
  plan: { label: 'Plan My Day', icon: faCalendarCheck },
  deadlines: { label: 'Deadline Detective', icon: faClock },
}

// All three panels stay mounted and are only hidden, so switching tabs keeps unsaved work
// (open Lazy Mode suggestions, the plan's time budget, dismissed suggestions) exactly as it was.
function Workspace({ tab, tasks, status, error, onRetry, onChange, onDelete }) {
  const tabRefs = useRef({})

  const onKeyDown = (event) => {
    const direction = { ArrowRight: 1, ArrowLeft: -1 }[event.key]
    if (!direction) return
    event.preventDefault()
    const next = nextTab(tab, direction)
    window.location.hash = hrefFor(next)
    tabRefs.current[next]?.focus()
  }

  return (
    <div className="workspace">
      <h1 className="page-title">Workspace</h1>
      <div className="tabs" role="tablist" aria-label="Workspace sections" onKeyDown={onKeyDown}>
        {TABS.map((key) => (
          <button
            key={key}
            ref={(el) => {
              tabRefs.current[key] = el
            }}
            type="button"
            role="tab"
            id={`tab-${key}`}
            className="tab"
            aria-selected={tab === key}
            aria-controls={`panel-${key}`}
            tabIndex={tab === key ? 0 : -1}
            onClick={() => {
              window.location.hash = hrefFor(key)
            }}
          >
            <FontAwesomeIcon icon={TAB_META[key].icon} fixedWidth />
            <span>{TAB_META[key].label}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id="panel-tasks" aria-labelledby="tab-tasks" hidden={tab !== 'tasks'}>
        <TaskList
          tasks={tasks}
          status={status}
          error={error}
          onRetry={onRetry}
          onChange={onChange}
          onDelete={onDelete}
        />
      </div>
      <div role="tabpanel" id="panel-plan" aria-labelledby="tab-plan" hidden={tab !== 'plan'}>
        <DailyPlan tasks={tasks} status={status} error={error} onRetry={onRetry} />
      </div>
      <div
        role="tabpanel"
        id="panel-deadlines"
        aria-labelledby="tab-deadlines"
        hidden={tab !== 'deadlines'}
      >
        <DeadlineDetective tasks={tasks} status={status} error={error} onRetry={onRetry} />
      </div>
    </div>
  )
}

export default Workspace
