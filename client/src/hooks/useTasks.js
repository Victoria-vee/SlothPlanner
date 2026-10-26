import { useCallback, useEffect, useState } from 'react'
import { createTask, deleteTask, listTasks, updateTask } from '../api.js'

// Mutation helpers throw on failure and only change local state after the API confirms success.
export function useTasks() {
  const [tasks, setTasks] = useState([])
  const [status, setStatus] = useState('loading')
  const [error, setError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    listTasks({ signal: controller.signal })
      .then((loaded) => {
        setTasks(loaded)
        setStatus('ready')
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setError(err.message)
        setStatus('error')
      })

    return () => controller.abort()
  }, [reloadKey])

  const retry = useCallback(() => {
    setStatus('loading')
    setReloadKey((key) => key + 1)
  }, [])

  const addTask = useCallback(async (fields) => {
    const created = await createTask(fields)
    setTasks((current) => [created, ...current])
  }, [])

  const changeTask = useCallback(async (id, changes) => {
    const updated = await updateTask(id, changes)
    setTasks((current) => current.map((task) => (task.id === id ? updated : task)))
  }, [])

  const removeTask = useCallback(async (id) => {
    await deleteTask(id)
    setTasks((current) => current.filter((task) => task.id !== id))
  }, [])

  return { tasks, status, error, retry, addTask, changeTask, removeTask }
}
