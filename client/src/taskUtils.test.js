import test from 'node:test'
import assert from 'node:assert/strict'
import {
  classifyDeadline,
  deadlineTag,
  explainFlag,
  formatDue,
  groupDeadlines,
  isAtRisk,
  suggestActions,
  summarizeTasks,
} from './taskUtils.js'

// Local-time dates, so the tests hold in any time zone.
const NOW = new Date(2026, 9, 25, 12, 0, 0)
const hoursFromNow = (h) => new Date(NOW.getTime() + h * 3600000).toISOString()
const task = (over = {}) => ({ id: 'x', title: 'T', status: 'pending', dueDate: null, ...over })
const dateOnly = (y, m, d) => new Date(y, m - 1, d, 23, 59, 0).toISOString()

test('overdue: open task whose deadline has passed', () => {
  assert.equal(classifyDeadline(task({ dueDate: hoursFromNow(-3) }), NOW), 'overdue')
  assert.equal(classifyDeadline(task({ status: 'in_progress', dueDate: hoursFromNow(-1) }), NOW), 'overdue')
})

test('due soon: within the next 24 hours', () => {
  assert.equal(classifyDeadline(task({ dueDate: hoursFromNow(5) }), NOW), 'due_soon')
})

test('future deadline beyond 24 hours is not flagged', () => {
  const t = task({ dueDate: hoursFromNow(24.1) })
  assert.equal(classifyDeadline(t, NOW), 'upcoming')
  assert.equal(isAtRisk(t, NOW), false)
})

test('missing deadline is its own state, never overdue or at risk', () => {
  for (const dueDate of [null, undefined, '']) {
    const t = task({ dueDate })
    assert.equal(classifyDeadline(t, NOW), 'no_deadline')
    assert.equal(isAtRisk(t, NOW), false)
  }
})

test('invalid deadline string is treated as no deadline', () => {
  assert.equal(classifyDeadline(task({ dueDate: 'not a date' }), NOW), 'no_deadline')
})

test('completed tasks are never overdue or due soon', () => {
  assert.equal(classifyDeadline(task({ status: 'completed', dueDate: hoursFromNow(-48) }), NOW), 'completed')
  assert.equal(classifyDeadline(task({ status: 'completed', dueDate: hoursFromNow(2) }), NOW), 'completed')
  assert.equal(isAtRisk(task({ status: 'completed', dueDate: hoursFromNow(-48) }), NOW), false)
})

test('boundaries: exactly now, exactly 24h, just past 24h', () => {
  assert.equal(classifyDeadline(task({ dueDate: NOW.toISOString() }), NOW), 'due_soon')
  assert.equal(classifyDeadline(task({ dueDate: new Date(NOW.getTime() - 1).toISOString() }), NOW), 'overdue')
  assert.equal(classifyDeadline(task({ dueDate: hoursFromNow(24) }), NOW), 'due_soon')
  assert.equal(classifyDeadline(task({ dueDate: new Date(NOW.getTime() + 24 * 3600000 + 1).toISOString() }), NOW), 'upcoming')
})

test('date-only deadlines (23:59 local) have no off-by-one-day errors', () => {
  const today = task({ dueDate: dateOnly(2026, 10, 25) })
  const yesterday = task({ dueDate: dateOnly(2026, 10, 24) })
  const tomorrow = task({ dueDate: dateOnly(2026, 10, 26) })
  const later = task({ dueDate: dateOnly(2026, 10, 28) })
  assert.equal(classifyDeadline(today, NOW), 'due_soon')
  assert.equal(classifyDeadline(yesterday, NOW), 'overdue')
  assert.equal(classifyDeadline(tomorrow, NOW), 'upcoming') // ~35h away
  assert.equal(classifyDeadline(later, NOW), 'upcoming')
  // Late evening of the due day: still not overdue until 23:59 passes.
  assert.equal(classifyDeadline(today, new Date(2026, 9, 25, 23, 0, 0)), 'due_soon')
  assert.equal(classifyDeadline(today, new Date(2026, 9, 26, 0, 1, 0)), 'overdue')
})

test('date-only deadlines display without a time, in local date', () => {
  const text = formatDue(dateOnly(2026, 10, 25))
  assert.match(text, /25/)
  assert.doesNotMatch(text, /11:59|23:59/)
  assert.match(formatDue(new Date(2026, 9, 25, 15, 30).toISOString()), /3:30|15:30/)
  assert.equal(formatDue(null), 'No deadline')
})

test('classification across a DST-length day uses calendar days', () => {
  // Late March / late October clock changes must not shift "yesterday" or "tomorrow".
  const now = new Date(2026, 9, 25, 9, 0, 0)
  assert.match(explainFlag(task({ dueDate: dateOnly(2026, 10, 24) }), now), /yesterday/)
  assert.match(explainFlag(task({ dueDate: dateOnly(2026, 10, 26) }), new Date(2026, 9, 25, 23, 59, 30)), /tomorrow/)
})

test('explanations use real data and stay empty for unflagged tasks', () => {
  assert.match(explainFlag(task({ dueDate: hoursFromNow(-3) }), NOW), /passed 3 hours ago/)
  assert.match(explainFlag(task({ dueDate: hoursFromNow(5) }), NOW), /Due in 5 hours/)
  assert.match(explainFlag(task({ dueDate: dateOnly(2026, 10, 25) }), NOW), /Due today/)
  assert.equal(explainFlag(task({ dueDate: hoursFromNow(100) }), NOW), '')
  assert.equal(explainFlag(task(), NOW), '')
})

test('suggestions exist only for flagged tasks and are plain text', () => {
  assert.ok(suggestActions(task({ dueDate: hoursFromNow(-3) }), NOW).length > 0)
  assert.ok(suggestActions(task({ dueDate: hoursFromNow(3) }), NOW).length > 0)
  assert.deepEqual(suggestActions(task(), NOW), [])
  assert.deepEqual(suggestActions(task({ status: 'completed', dueDate: hoursFromNow(-3) }), NOW), [])
})

test('every task lands in at most one group and totals add up', () => {
  const tasks = [
    task({ id: '1', dueDate: hoursFromNow(-3) }),
    task({ id: '2', dueDate: hoursFromNow(5) }),
    task({ id: '3', dueDate: hoursFromNow(100) }),
    task({ id: '4' }),
    task({ id: '5', status: 'completed', dueDate: hoursFromNow(-3) }),
  ]
  const g = groupDeadlines(tasks, NOW)
  assert.deepEqual(g.overdue.map((t) => t.id), ['1'])
  assert.deepEqual(g.dueSoon.map((t) => t.id), ['2'])
  assert.deepEqual(g.upcoming.map((t) => t.id), ['3'])
  assert.deepEqual(g.noDeadline.map((t) => t.id), ['4'])
  assert.deepEqual(summarizeTasks(tasks, NOW), { pending: 4, completed: 1, atRisk: 2 })
})

test('deadlineTag: overdue open tasks get an Overdue tag whatever their priority', () => {
  for (const priority of ['high', 'medium', 'low']) {
    const t = task({ priority, dueDate: hoursFromNow(-3) })
    assert.deepEqual(deadlineTag(t, NOW), { label: 'Overdue', tone: 'overdue' })
    assert.equal(t.priority, priority) // priority is left alone
  }
  assert.equal(deadlineTag(task({ status: 'in_progress', dueDate: hoursFromNow(-1) }), NOW).label, 'Overdue')
})

test('deadlineTag: date-only deadline yesterday is Overdue, today is Due soon', () => {
  assert.equal(deadlineTag(task({ dueDate: dateOnly(2026, 10, 24) }), NOW).label, 'Overdue')
  assert.equal(deadlineTag(task({ dueDate: dateOnly(2026, 10, 25) }), NOW).label, 'Due soon')
})

test('deadlineTag: completed tasks are never tagged, even with a past deadline', () => {
  assert.equal(deadlineTag(task({ status: 'completed', dueDate: hoursFromNow(-48) }), NOW), null)
  assert.equal(deadlineTag(task({ status: 'completed', dueDate: hoursFromNow(2) }), NOW), null)
})

test('deadlineTag: due soon, upcoming and no deadline', () => {
  assert.deepEqual(deadlineTag(task({ dueDate: hoursFromNow(5) }), NOW), { label: 'Due soon', tone: 'soon' })
  assert.equal(deadlineTag(task({ dueDate: hoursFromNow(100) }), NOW), null)
  assert.equal(deadlineTag(task(), NOW), null)
  assert.equal(deadlineTag(task({ dueDate: 'garbage' }), NOW), null)
})

test('deadlineTag: boundaries around now', () => {
  assert.equal(deadlineTag(task({ dueDate: NOW.toISOString() }), NOW).label, 'Due soon')
  assert.equal(deadlineTag(task({ dueDate: new Date(NOW.getTime() - 1).toISOString() }), NOW).label, 'Overdue')
})
