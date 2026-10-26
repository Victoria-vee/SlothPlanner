import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DURATION_MS,
  SOUND_STORAGE_KEY,
  TIMER_STORAGE_KEY,
  initialTimer,
  isTargetMissing,
  loadSoundPref,
  loadTimer,
  parseSoundPref,
  remainingMs,
  saveSoundPref,
  saveTimer,
  shouldPlayCompletionSound,
  timerReducer,
} from './timerCore.js'
import { ROUTES, hrefFor, nextTab, parseRoute } from './routes.js'
import { taskBadges } from './badges.js'

const target = { taskId: 'a', taskTitle: 'Write report', stepId: 's1', stepText: 'Open file' }
const T0 = 5_000_000
const start = (now = T0) => timerReducer(initialTimer, { type: 'start', now, target })

// A minimal localStorage stand-in. "Refreshing" means loading from the same store again.
const fakeStorage = (initial = {}) => {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (k) => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => void data.set(k, String(v)),
    removeItem: (k) => void data.delete(k),
  }
}
const brokenStorage = {
  getItem() {
    throw new Error('blocked')
  },
  setItem() {
    throw new Error('blocked')
  },
  removeItem() {
    throw new Error('blocked')
  },
}

// ---------- timer persistence across a refresh ----------

test('a running timer survives a refresh and keeps counting from its absolute end time', () => {
  const store = fakeStorage()
  saveTimer(store, start())
  const back = loadTimer(store, T0 + 100_000)
  assert.equal(back.status, 'running')
  assert.deepEqual(back.target, target)
  assert.equal(back.endAt, T0 + DURATION_MS)
  assert.equal(remainingMs(back, T0 + 100_000), DURATION_MS - 100_000)
})

test('a running timer that ran out while the page was closed restores as finished', () => {
  const store = fakeStorage()
  saveTimer(store, start())
  const back = loadTimer(store, T0 + DURATION_MS + 60_000)
  assert.equal(back.status, 'finished')
  assert.equal(remainingMs(back, T0 + DURATION_MS + 60_000), 0)
})

test('a paused timer restores paused with its frozen time, however long the page was closed', () => {
  const store = fakeStorage()
  saveTimer(store, timerReducer(start(), { type: 'pause', now: T0 + 120_000 }))
  const back = loadTimer(store, T0 + 99_000_000)
  assert.equal(back.status, 'paused')
  assert.equal(remainingMs(back, T0 + 99_000_000), DURATION_MS - 120_000)
})

test('a reset timer restores stopped at the full duration', () => {
  const store = fakeStorage()
  saveTimer(store, timerReducer(start(), { type: 'reset' }))
  const back = loadTimer(store, T0 + 1)
  assert.equal(back.status, 'ready')
  assert.equal(remainingMs(back, T0 + 50_000), DURATION_MS)
})

test('a finished timer restores finished with the completion actions still available', () => {
  const store = fakeStorage()
  const done = timerReducer(start(), { type: 'tick', now: T0 + DURATION_MS })
  saveTimer(store, done)
  const back = loadTimer(store, T0 + DURATION_MS + 5)
  assert.equal(back.status, 'finished')
  assert.equal(timerReducer(back, { type: 'keepGoing', now: T0 + DURATION_MS + 10 }).status, 'running')
  assert.deepEqual(timerReducer(back, { type: 'close' }), initialTimer)
})

test('cancelling clears the stored timer', () => {
  const store = fakeStorage()
  saveTimer(store, start())
  assert.ok(store.data.has(TIMER_STORAGE_KEY))
  saveTimer(store, timerReducer(start(), { type: 'close' }))
  assert.equal(store.data.has(TIMER_STORAGE_KEY), false)
  assert.equal(loadTimer(store, T0).status, 'idle')
})

test('the stored timer holds only timer metadata, nothing else', () => {
  const store = fakeStorage()
  saveTimer(store, start())
  const saved = JSON.parse(store.data.get(TIMER_STORAGE_KEY))
  assert.deepEqual(Object.keys(saved).sort(), ['endAt', 'remainingMs', 'status', 'target'])
  assert.deepEqual(Object.keys(saved.target).sort(), ['stepId', 'stepText', 'taskId', 'taskTitle'])
})

test('a restored timer blocks starting a second one', () => {
  const store = fakeStorage()
  saveTimer(store, start())
  const back = loadTimer(store, T0 + 1000)
  const other = { taskId: 'b', taskTitle: 'Other', stepId: null, stepText: null }
  assert.equal(timerReducer(back, { type: 'start', now: T0 + 2000, target: other }), back)
})

test('corrupt, stale or unreadable stored data restores to idle without throwing', () => {
  for (const bad of ['{', 'null', '42', '"x"', '{"status":"running"}', '{"status":"running","target":{"taskId":1},"endAt":5}']) {
    assert.equal(loadTimer(fakeStorage({ [TIMER_STORAGE_KEY]: bad }), T0).status, 'idle')
  }
  assert.equal(loadTimer(fakeStorage(), T0).status, 'idle')
  assert.equal(loadTimer(brokenStorage, T0).status, 'idle')
  assert.doesNotThrow(() => saveTimer(brokenStorage, start()))
})

// ---------- missing tasks ----------

test('a timer whose task was deleted is detected, and one whose task exists is kept', () => {
  assert.equal(isTargetMissing(target, [{ id: 'a' }, { id: 'b' }]), false)
  assert.equal(isTargetMissing(target, [{ id: 'b' }]), true)
  assert.equal(isTargetMissing(target, []), true)
})

// ---------- sound ----------

test('sound defaults to on and the preference persists', () => {
  const store = fakeStorage()
  assert.equal(loadSoundPref(store), true)
  saveSoundPref(store, false)
  assert.equal(store.data.get(SOUND_STORAGE_KEY), 'off')
  assert.equal(loadSoundPref(store), false)
  saveSoundPref(store, true)
  assert.equal(loadSoundPref(store), true)
})

test('sound preference tolerates junk values and blocked storage', () => {
  assert.equal(parseSoundPref(null), true)
  assert.equal(parseSoundPref('garbage'), true)
  assert.equal(parseSoundPref('off'), false)
  assert.equal(loadSoundPref(brokenStorage), true)
  assert.doesNotThrow(() => saveSoundPref(brokenStorage, false))
})

test('the chime fires only when a running timer reaches completion', () => {
  const running = start()
  const finished = timerReducer(running, { type: 'tick', now: T0 + DURATION_MS })
  assert.equal(shouldPlayCompletionSound(running, finished), true)
  const paused = timerReducer(running, { type: 'pause', now: T0 + 1000 })
  const reset = timerReducer(running, { type: 'reset' })
  const closed = timerReducer(running, { type: 'close' })
  for (const next of [paused, reset, closed]) assert.equal(shouldPlayCompletionSound(running, next), false)
})

test('restoring an already finished timer is not a transition, so it makes no sound', () => {
  const store = fakeStorage()
  saveTimer(store, timerReducer(start(), { type: 'tick', now: T0 + DURATION_MS }))
  const restored = loadTimer(store, T0 + DURATION_MS + 1000)
  // The provider seeds its "previous" state with the restored state, so there is no running -> finished step.
  assert.equal(shouldPlayCompletionSound(restored, restored), false)
  // Re-rendering or a strict-mode double effect compares a state with itself.
  const done = timerReducer(start(), { type: 'tick', now: T0 + DURATION_MS })
  assert.equal(shouldPlayCompletionSound(done, done), false)
})

test('exactly one completion per run, including keep going', () => {
  let state = initialTimer
  let plays = 0
  const apply = (action) => {
    const next = timerReducer(state, action)
    if (shouldPlayCompletionSound(state, next)) plays += 1
    state = next
  }
  apply({ type: 'start', now: T0, target })
  apply({ type: 'tick', now: T0 + 1000 })
  apply({ type: 'tick', now: T0 + DURATION_MS })
  apply({ type: 'tick', now: T0 + DURATION_MS + 250 })
  apply({ type: 'tick', now: T0 + DURATION_MS + 500 })
  assert.equal(plays, 1)
  apply({ type: 'keepGoing', now: T0 + DURATION_MS + 600 })
  apply({ type: 'tick', now: T0 + 2 * DURATION_MS + 600 })
  assert.equal(plays, 2)
})

// ---------- navigation ----------

test('routes: dashboard is home, the others are workspace tabs', () => {
  assert.deepEqual(parseRoute(''), { key: 'dashboard', page: 'dashboard' })
  assert.deepEqual(parseRoute('#/'), { key: 'dashboard', page: 'dashboard' })
  assert.deepEqual(parseRoute('#/tasks'), { key: 'tasks', page: 'workspace' })
  assert.deepEqual(parseRoute('#/plan/'), { key: 'plan', page: 'workspace' })
  assert.deepEqual(parseRoute('#/DEADLINES'), { key: 'deadlines', page: 'workspace' })
})

test('routes: the review page is its own page, not a workspace tab', () => {
  assert.deepEqual(parseRoute('#/review'), { key: 'review', page: 'review' })
})

test('routes: unknown or malformed hashes fall back to the dashboard, old bookmarks still work', () => {
  for (const bad of ['#/nope', '#', null, undefined, 5, '#/tasks/extra']) {
    assert.equal(parseRoute(bad).key, 'dashboard')
  }
  assert.equal(parseRoute('#my-tasks').key, 'tasks')
  assert.equal(parseRoute('#plan-my-day').key, 'plan')
  assert.equal(parseRoute('#deadline-detective').key, 'deadlines')
})

test('routes: every route round-trips through its href', () => {
  for (const key of Object.keys(ROUTES)) assert.equal(parseRoute(hrefFor(key)).key, key)
  assert.equal(hrefFor('unknown'), ROUTES.dashboard)
})

test('tabs: arrow keys wrap around', () => {
  assert.equal(nextTab('tasks', 1), 'plan')
  assert.equal(nextTab('deadlines', 1), 'tasks')
  assert.equal(nextTab('tasks', -1), 'deadlines')
  assert.equal(nextTab('nope', 1), 'plan')
})

// ---------- badges ----------

const NOW = new Date(2026, 9, 25, 12, 0, 0)
const hours = (h) => new Date(NOW.getTime() + h * 3600000).toISOString()

test('overdue incomplete tasks show an Overdue badge and keep their own priority separately', () => {
  const task = { status: 'pending', priority: 'medium', dueDate: hours(-5) }
  const b = taskBadges(task, NOW)
  assert.equal(b.deadline.label, 'Overdue')
  assert.equal(b.priority.label, 'Medium priority')
  assert.equal(task.priority, 'medium') // stored priority is untouched
})

test('priority and deadline badges are independent for every priority', () => {
  for (const priority of ['high', 'medium', 'low']) {
    const b = taskBadges({ status: 'pending', priority, dueDate: hours(-1) }, NOW)
    assert.equal(b.deadline.tone, 'overdue')
    assert.equal(b.priority.value, priority)
  }
})

test('due soon, upcoming, no deadline and completed tasks get the right deadline badge', () => {
  assert.equal(taskBadges({ status: 'pending', priority: 'low', dueDate: hours(5) }, NOW).deadline.label, 'Due soon')
  assert.equal(taskBadges({ status: 'pending', priority: 'low', dueDate: hours(200) }, NOW).deadline, null)
  assert.equal(taskBadges({ status: 'pending', priority: 'low', dueDate: null }, NOW).deadline, null)
  const done = taskBadges({ status: 'completed', priority: 'high', dueDate: hours(-50) }, NOW)
  assert.equal(done.deadline, null)
  assert.equal(done.priority.label, 'High priority')
})

test('an unknown priority produces no priority badge instead of a wrong one', () => {
  assert.equal(taskBadges({ status: 'pending', priority: 'urgent', dueDate: null }, NOW).priority, null)
})
