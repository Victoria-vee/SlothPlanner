import TaskItem from './TaskItem.jsx'

function TaskList({ tasks, status, error, onRetry, onChange, onDelete }) {
  return (
    <section id="my-tasks" className="card" aria-labelledby="tasks-heading">
      <h2 id="tasks-heading">My Tasks</h2>

      {status === 'loading' && (
        <p className="muted state-message" role="status">
          Loading your tasks…
        </p>
      )}

      {status === 'error' && (
        <div className="state-message" role="alert">
          <p className="form-error">Could not load tasks: {error}</p>
          <button type="button" className="btn-secondary" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}

      {status === 'ready' && tasks.length === 0 && (
        <p className="muted state-message">
          No tasks yet. Untangle your brain above to get started.
        </p>
      )}

      {status === 'ready' && tasks.length > 0 && (
        <ul className="task-list">
          {tasks.map((task) => (
            <TaskItem key={task.id} task={task} onChange={onChange} onDelete={onDelete} />
          ))}
        </ul>
      )}
    </section>
  )
}

export default TaskList
