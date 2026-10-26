const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

export async function apiRequest(path, { method = 'GET', body, signal } = {}) {
  let response
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      signal,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  } catch (error) {
    if (error.name === 'AbortError') throw error
    throw new Error('Could not reach the backend. Is the server running?', { cause: error })
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`
    try {
      const data = await response.json()
      message = data.details?.length ? data.details.join('. ') : data.error || message
    } catch {
      // response had no JSON body; keep the generic message
    }
    throw new Error(message)
  }

  return response.status === 204 ? null : response.json()
}

export const apiGet = (path, options) => apiRequest(path, options)

export const getHealth = (options) => apiGet('/api/health', options)

export const listTasks = (options) => apiGet('/api/tasks', options).then((data) => data.tasks)

export const createTask = (task) =>
  apiRequest('/api/tasks', { method: 'POST', body: task }).then((data) => data.task)

export const updateTask = (id, changes) =>
  apiRequest(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: changes }).then(
    (data) => data.task,
  )

export const deleteTask = (id) =>
  apiRequest(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const brainDump = (text, options) =>
  apiRequest('/api/brain-dump', {
    method: 'POST',
    body: { text, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    ...options,
  }).then((data) => data.suggestions)

export const suggestSteps = (task, existingSteps, options) =>
  apiRequest('/api/lazy-mode', {
    method: 'POST',
    body: {
      title: task.title,
      description: task.description || '',
      status: task.status,
      existingSteps,
    },
    ...options,
  }).then((data) => data.steps)
