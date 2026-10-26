// Hash-based routes, so browser back/forward works without a routing dependency.
// Dashboard is the home page; the other three are tabs of the Workspace page.

export const ROUTES = {
  dashboard: '#/',
  tasks: '#/tasks',
  plan: '#/plan',
  deadlines: '#/deadlines',
  review: '#/review',
}

export const TABS = ['tasks', 'plan', 'deadlines']

// Older bookmarks used element ids as hashes.
const LEGACY = {
  '#my-tasks': 'tasks',
  '#plan-my-day': 'plan',
  '#deadline-detective': 'deadlines',
  '#dashboard': 'dashboard',
}

/** Returns { key, page } where key is one of dashboard | tasks | plan | deadlines. Unknown hashes fall back to the dashboard. */
export function parseRoute(hash) {
  const text = typeof hash === 'string' ? hash.trim().toLowerCase() : ''
  const path = text.replace(/\/+$/, '')
  const found = Object.entries(ROUTES).find(([, value]) => value.replace(/\/+$/, '') === path)
  const key = found ? found[0] : (LEGACY[path] ?? 'dashboard')
  const page = key === 'dashboard' ? 'dashboard' : key === 'review' ? 'review' : 'workspace'
  return { key, page }
}

export const hrefFor = (key) => ROUTES[key] ?? ROUTES.dashboard

/** Next tab for arrow-key navigation, wrapping around. */
export function nextTab(current, direction) {
  const i = TABS.indexOf(current)
  const start = i === -1 ? 0 : i
  return TABS[(start + direction + TABS.length) % TABS.length]
}
