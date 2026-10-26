import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DURATION_MS,
  formatClock,
  initialTimer,
  isActive,
  remainingMs,
  restoreTimer,
  serializeTimer,
  timerReducer,
} from './timerCore.js'

const target = { taskId: 'a', taskTitle: 'Write report', stepId: null, stepText: null }
const T0 = 1_000_000
const start = (now = T0, state = initialTimer) => timerReducer(state, { type: 'start', now, target })

test('starting begins a five-minute countdown from the given clock', () => {
  const s = start()
  assert.equal(s.status, 'running')
  assert.equal(s.endAt, T0 + DURATION_MS)
  assert.equal(remainingMs(s, T0), DURATION_MS)
  assert.equal(remainingMs(s, T0 + 60_000), DURATION_MS - 60_000)
})

test('remaining time comes from the clock, so a delayed render does not drift', () => {
  const s = start()
  // No ticks at all for 4 minutes (e.g. throttled tab): the value is still exact.
  assert.equal(remainingMs(s, T0 + 4 * 60_000), 60_000)
})

test('remaining time is clamped between zero and the full duration', () => {
  const s = start()
  assert.equal(remainingMs(s, T0 + DURATION_MS + 9999), 0)
  assert.equal(remainingMs(s, T0 - 5000), DURATION_MS)
})

test('clock text rounds up so it never shows 0:00 before the end', () => {
  assert.equal(formatClock(DURATION_MS), '5:00')
  assert.equal(formatClock(61_000), '1:01')
  assert.equal(formatClock(59_001), '1:00')
  assert.equal(formatClock(1), '0:01')
  assert.equal(formatClock(0), '0:00')
})

test('pause freezes the remaining time and resume continues from it', () => {
  const running = start()
  const paused = timerReducer(running, { type: 'pause', now: T0 + 90_000 })
  assert.equal(paused.status, 'paused')
  assert.equal(remainingMs(paused, T0 + 999_999), DURATION_MS - 90_000)
  const resumed = timerReducer(paused, { type: 'resume', now: T0 + 500_000 })
  assert.equal(resumed.status, 'running')
  assert.equal(remainingMs(resumed, T0 + 500_000), DURATION_MS - 90_000)
  assert.equal(remainingMs(resumed, T0 + 500_000 + 30_000), DURATION_MS - 120_000)
})

test('pause and resume in the wrong state do nothing', () => {
  assert.equal(timerReducer(initialTimer, { type: 'pause', now: T0 }), initialTimer)
  assert.equal(timerReducer(initialTimer, { type: 'resume', now: T0 }), initialTimer)
  const running = start()
  assert.equal(timerReducer(running, { type: 'resume', now: T0 + 1 }), running)
})

test('pausing after the end time finishes instead of pausing at zero', () => {
  const s = timerReducer(start(), { type: 'pause', now: T0 + DURATION_MS + 1 })
  assert.equal(s.status, 'finished')
})

test('reset returns to a full, stopped five minutes for the same task, then can restart', () => {
  const paused = timerReducer(start(), { type: 'pause', now: T0 + 100_000 })
  const reset = timerReducer(paused, { type: 'reset' })
  assert.equal(reset.status, 'ready')
  assert.equal(remainingMs(reset, T0 + 10_000_000), DURATION_MS)
  assert.equal(reset.target, target)
  const again = timerReducer(reset, { type: 'resume', now: T0 + 200_000 })
  assert.equal(again.status, 'running')
  assert.equal(again.endAt, T0 + 200_000 + DURATION_MS)
  assert.equal(timerReducer(initialTimer, { type: 'reset' }), initialTimer)
})

test('reset while running stops the clock', () => {
  const reset = timerReducer(start(), { type: 'reset' })
  assert.equal(remainingMs(reset, T0 + 60_000), DURATION_MS)
})

test('the timer finishes exactly when the end time is reached, not before', () => {
  const s = start()
  assert.equal(timerReducer(s, { type: 'tick', now: T0 + DURATION_MS - 1 }), s)
  const done = timerReducer(s, { type: 'tick', now: T0 + DURATION_MS })
  assert.equal(done.status, 'finished')
  assert.equal(remainingMs(done, T0 + DURATION_MS + 5000), 0)
})

test('finishing never touches the task: the state only describes the timer', () => {
  const done = timerReducer(start(), { type: 'tick', now: T0 + DURATION_MS })
  assert.deepEqual(Object.keys(done).sort(), ['endAt', 'remainingMs', 'status', 'target'])
  assert.equal(done.target, target)
})

test('ticks are ignored when not running, so a paused timer cannot finish', () => {
  const paused = timerReducer(start(), { type: 'pause', now: T0 + 1000 })
  assert.equal(timerReducer(paused, { type: 'tick', now: T0 + DURATION_MS * 3 }), paused)
})

test('keep going starts a fresh five minutes for the same target, only after finishing', () => {
  const running = start()
  assert.equal(timerReducer(running, { type: 'keepGoing', now: T0 }), running)
  const done = timerReducer(running, { type: 'tick', now: T0 + DURATION_MS })
  const more = timerReducer(done, { type: 'keepGoing', now: T0 + DURATION_MS + 10 })
  assert.equal(more.status, 'running')
  assert.equal(more.target, target)
  assert.equal(more.endAt, T0 + DURATION_MS + 10 + DURATION_MS)
})

test('"I am done for now" clears the timer', () => {
  const done = timerReducer(start(), { type: 'tick', now: T0 + DURATION_MS })
  assert.deepEqual(timerReducer(done, { type: 'close' }), initialTimer)
})

test('a second timer cannot start while one is running, paused or waiting after reset', () => {
  const other = { taskId: 'b', taskTitle: 'Other', stepId: null, stepText: null }
  let s = start()
  assert.equal(timerReducer(s, { type: 'start', now: T0 + 5, target: other }), s)
  s = timerReducer(s, { type: 'pause', now: T0 + 10 })
  assert.equal(timerReducer(s, { type: 'start', now: T0 + 20, target: other }), s)
  s = timerReducer(s, { type: 'reset' })
  assert.equal(timerReducer(s, { type: 'start', now: T0 + 30, target: other }), s)
  assert.equal(s.target, target)
  assert.equal(isActive(s), true)
})

test('a new timer can start for another task once the previous one has finished', () => {
  const other = { taskId: 'b', taskTitle: 'Other', stepId: 's1', stepText: 'Step' }
  const done = timerReducer(start(), { type: 'tick', now: T0 + DURATION_MS })
  const next = timerReducer(done, { type: 'start', now: T0 + DURATION_MS + 1, target: other })
  assert.equal(next.status, 'running')
  assert.equal(next.target, other)
})

test('unknown actions leave the state alone', () => {
  assert.equal(timerReducer(initialTimer, { type: 'nope' }), initialTimer)
})

test('a running timer is restored with its original end time (survives a refresh)', () => {
  const running = start()
  const restored = restoreTimer(serializeTimer(running), T0 + 60_000)
  assert.equal(restored.status, 'running')
  assert.equal(restored.endAt, running.endAt)
  assert.equal(remainingMs(restored, T0 + 60_000), DURATION_MS - 60_000)
})

test('a timer that ended while the page was closed comes back as finished, exactly at the end time', () => {
  const saved = serializeTimer(start())
  assert.equal(restoreTimer(saved, T0 + DURATION_MS - 1).status, 'running')
  assert.equal(restoreTimer(saved, T0 + DURATION_MS).status, 'finished')
  assert.equal(restoreTimer(saved, T0 + 10 * DURATION_MS).status, 'finished')
})

test('paused time does not run down while the page is closed', () => {
  const paused = timerReducer(start(), { type: 'pause', now: T0 + 100_000 })
  const restored = restoreTimer(serializeTimer(paused), T0 + 99_999_999)
  assert.equal(restored.status, 'paused')
  assert.equal(remainingMs(restored, T0 + 99_999_999), DURATION_MS - 100_000)
})

test('ready and finished states restore with their task', () => {
  const ready = timerReducer(start(), { type: 'reset' })
  assert.equal(restoreTimer(serializeTimer(ready), T0).status, 'ready')
  const done = timerReducer(start(), { type: 'tick', now: T0 + DURATION_MS })
  const back = restoreTimer(serializeTimer(done), T0 + DURATION_MS + 5)
  assert.equal(back.status, 'finished')
  assert.deepEqual(back.target, target)
})

test('idle is not stored, and missing or corrupt saved data restores to idle', () => {
  assert.equal(serializeTimer(initialTimer), null)
  for (const bad of [null, '', 'nope', '{}', '[]', '{"status":"running"}', JSON.stringify({ status: 'running', target: { taskId: 5 }, endAt: 1 }), JSON.stringify({ status: 'running', target, endAt: 'x' }), JSON.stringify({ status: 'weird', target })]) {
    assert.equal(restoreTimer(bad, T0).status, 'idle')
  }
})

test('a paused remaining time outside 0..5 minutes is clamped', () => {
  const raw = JSON.stringify({ status: 'paused', target, endAt: null, remainingMs: 999_999_999 })
  assert.equal(restoreTimer(raw, T0).remainingMs, DURATION_MS)
})
