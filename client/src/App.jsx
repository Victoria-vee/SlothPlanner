import { useEffect, useState } from 'react'
import './App.css'
import Navbar from './components/Navbar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Workspace from './components/Workspace.jsx'
import ReviewPage from './components/ReviewPage.jsx'
import FocusTimer from './components/FocusTimer.jsx'
import { useTasks } from './hooks/useTasks.js'
import { useRoute } from './hooks/useRoute.js'
import { useFocusTimer } from './timerContext.js'
import { isTargetMissing } from './timerCore.js'

function App() {
  const route = useRoute()
  const [reviewTarget, setReviewTarget] = useState(null)
  const { tasks, status, error, retry, addTask, changeTask, removeTask } = useTasks()
  const { timer, close } = useFocusTimer()

  // Once tasks are loaded, drop a restored timer whose task no longer exists.
  const orphaned =
    status === 'ready' && timer.status !== 'idle' && isTargetMissing(timer.target, tasks)
  useEffect(() => {
    if (orphaned) close()
  }, [orphaned, close])

  // Both pages stay mounted and are only hidden, so a half-written brain dump or open review
  // is still there when you come back to the Dashboard.
  return (
    <div className="app">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <Navbar activeKey={route.key} />
      <main id="main" className="container main">
        <FocusTimer />
        <div hidden={route.page !== 'dashboard'}>
          <Dashboard tasks={tasks} status={status} onAddTask={addTask} reviewTarget={reviewTarget} />
        </div>
        <div hidden={route.page !== 'review'}>
          <ReviewPage setTarget={setReviewTarget} />
        </div>
        <div hidden={route.page !== 'workspace'}>
          <Workspace
            tab={route.page === 'workspace' ? route.key : 'tasks'}
            tasks={tasks}
            status={status}
            error={error}
            onRetry={retry}
            onChange={changeTask}
            onDelete={removeTask}
          />
        </div>
      </main>
    </div>
  )
}

export default App
