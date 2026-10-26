import StatCard from './StatCard.jsx'
import { summarizeTasks } from '../taskUtils.js'

function TaskOverview({ tasks, ready }) {
  const { pending, completed, atRisk } = summarizeTasks(tasks)
  const show = (n) => (ready ? n : '–')

  return (
    <section aria-labelledby="overview-heading">
      <h2 id="overview-heading" className="visually-hidden">
        Task overview
      </h2>
      <dl className="stats">
        <StatCard label="Pending" value={show(pending)} tone="pending" />
        <StatCard label="Completed" value={show(completed)} tone="done" />
        <StatCard label="At risk" value={show(atRisk)} tone="risk" />
      </dl>
    </section>
  )
}

export default TaskOverview
