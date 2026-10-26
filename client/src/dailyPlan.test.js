import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeBudget, planDay, summarizePlan, MAX_SUGGESTIONS } from './dailyPlan.js'

const NOW = new Date(2026, 9, 25, 12, 0, 0)
const iso = (hours) => new Date(NOW.getTime() + hours * 3600000).toISOString()
let n = 0
const task = (over = {}) => ({
  id: `t${++n}`,
  title: 'Task',
  status: 'pending',
  priority: 'medium',
  dueDate: null,
  estimatedMinutes: null,
  ...over,
})
const ids = (r) => r.suggestions.map((s) => s.task.id)

test('empty task list gives an empty plan', () => {
  const r = planDay([], { now: NOW })
  assert.deepEqual(r.suggestions, [])
  assert.deepEqual(r.notFit, [])
})

test('completed tasks are never suggested', () => {
  const done = task({ status: 'completed', dueDate: iso(-5), priority: 'high' })
  assert.deepEqual(planDay([done], { now: NOW }).suggestions, [])
})

test('overdue tasks come first and the reason says so, without touching the task', () => {
  const overdue = task({ id: 'o', dueDate: iso(-30) })
  const soon = task({ id: 's', dueDate: iso(5), priority: 'high' })
  const copy = structuredClone(overdue)
  const r = planDay([soon, overdue], { now: NOW })
  assert.equal(r.suggestions[0].task.id, 'o')
  assert.match(r.suggestions[0].reasons.join(' '), /overdue/i)
  assert.deepEqual(overdue, copy)
})

test('nearer deadlines rank above later ones', () => {
  const a = task({ id: 'a', dueDate: iso(20) })
  const b = task({ id: 'b', dueDate: iso(3) })
  const c = task({ id: 'c', dueDate: iso(24 * 4) })
  assert.deepEqual(ids(planDay([c, a, b], { now: NOW })), ['b', 'a', 'c'])
})

test('priority breaks ties between similar deadlines', () => {
  const low = task({ id: 'low', priority: 'low', dueDate: iso(48) })
  const high = task({ id: 'high', priority: 'high', dueDate: iso(48) })
  assert.deepEqual(ids(planDay([low, high], { now: NOW })), ['high', 'low'])
})

test('no-deadline tasks are not treated as due today and are labelled as spare time', () => {
  const nodue = task({ id: 'n' })
  const r = planDay([nodue], { now: NOW })
  assert.equal(r.suggestions[0].tier, 4)
  assert.match(r.suggestions[0].reasons.join(' '), /spare time; no deadline is set/)
  assert.doesNotMatch(r.suggestions[0].reasons.join(' '), /overdue|approaching/i)
})

test('spare-time tasks are capped so they do not crowd out deadlines', () => {
  const many = Array.from({ length: 6 }, () => task())
  assert.equal(planDay(many, { now: NOW }).suggestions.length, 2)
})

test('shortlist is capped', () => {
  const many = Array.from({ length: 12 }, (_, i) => task({ dueDate: iso(2 + i) }))
  assert.equal(planDay(many, { now: NOW }).suggestions.length, MAX_SUGGESTIONS)
})

test('the plan mixes in quick tasks instead of only large ones', () => {
  const big1 = task({ id: 'b1', dueDate: iso(24 * 3), estimatedMinutes: 240 })
  const big2 = task({ id: 'b2', dueDate: iso(24 * 3 + 1), estimatedMinutes: 300 })
  const quick = task({ id: 'q', dueDate: iso(24 * 4), estimatedMinutes: 15 })
  const got = ids(planDay([big1, big2, quick], { now: NOW }))
  assert.deepEqual(got.sort(), ['b1', 'q'])
})

test('budget: tasks that fit are chosen and the total stays within it', () => {
  const a = task({ id: 'a', dueDate: iso(3), estimatedMinutes: 30 })
  const b = task({ id: 'b', dueDate: iso(30), estimatedMinutes: 90 })
  const c = task({ id: 'c', dueDate: iso(40), estimatedMinutes: 20 })
  const r = planDay([a, b, c], { now: NOW, budgetMinutes: 60 })
  assert.deepEqual(ids(r).sort(), ['a', 'c'])
})

test('budget edge: a task exactly equal to the budget fits; one minute more does not', () => {
  const exact = task({ id: 'e', dueDate: iso(3), estimatedMinutes: 60 })
  assert.equal(planDay([exact], { now: NOW, budgetMinutes: 60 }).suggestions[0].exceedsBudget, false)
  const over = task({ id: 'o', dueDate: iso(3), estimatedMinutes: 61 })
  const r = planDay([over], { now: NOW, budgetMinutes: 60 })
  assert.equal(r.suggestions[0].exceedsBudget, true)
})

test('budget: an urgent task larger than the budget is shown with an explanation, not hidden', () => {
  const big = task({ id: 'big', dueDate: iso(-2), estimatedMinutes: 180 })
  const small = task({ id: 'small', dueDate: iso(30), estimatedMinutes: 10 })
  const r = planDay([big, small], { now: NOW, budgetMinutes: 60 })
  assert.equal(r.suggestions[0].task.id, 'big')
  assert.equal(r.suggestions[0].exceedsBudget, true)
  assert.ok(r.notes.some((x) => /more than your/.test(x)))
  assert.ok(!ids(r).includes('small'))
})

test('budget: later urgent tasks that do not fit are listed separately, not silently dropped', () => {
  const first = task({ id: 'f', dueDate: iso(-1), estimatedMinutes: 40 })
  const second = task({ id: 's', dueDate: iso(2), estimatedMinutes: 40 })
  const r = planDay([first, second], { now: NOW, budgetMinutes: 60 })
  assert.deepEqual(ids(r), ['f'])
  assert.deepEqual(r.notFit.map((x) => x.task.id), ['s'])
})

test('missing durations are never treated as zero or guessed', () => {
  const unknown = task({ id: 'u', dueDate: iso(3) })
  const r = planDay([unknown], { now: NOW, budgetMinutes: 30 })
  assert.equal(r.suggestions[0].minutes, null)
  assert.match(r.suggestions[0].reasons.join(' '), /No time estimate yet/)
  const s = summarizePlan([unknown], 30)
  assert.equal(s.knownMinutes, 0)
  assert.equal(s.unknownCount, 1)
  assert.equal(s.fit, 'uncertain')
})

test('with a budget, only a couple of unknown-duration tasks are added', () => {
  const many = Array.from({ length: 5 }, (_, i) => task({ dueDate: iso(2 + i) }))
  assert.equal(planDay(many, { now: NOW, budgetMinutes: 120 }).suggestions.length, 2)
})

test('no budget still gives a shortlist and makes no claim about free time', () => {
  const a = task({ dueDate: iso(3), estimatedMinutes: 500 })
  const r = planDay([a], { now: NOW })
  assert.equal(r.budget, null)
  assert.equal(r.suggestions.length, 1)
  assert.equal(r.suggestions[0].exceedsBudget, false)
  assert.equal(summarizePlan([a], null).fit, null)
})

test('invalid or non-positive budgets are treated as no budget', () => {
  for (const v of [0, -5, NaN, '', 'abc', null, undefined]) assert.equal(normalizeBudget(v), null)
  assert.equal(normalizeBudget('60'), 60)
})

test('excluded (planned or dismissed) tasks are not suggested again', () => {
  const a = task({ id: 'a', dueDate: iso(3) })
  const b = task({ id: 'b', dueDate: iso(4) })
  assert.deepEqual(ids(planDay([a, b], { now: NOW, excludeIds: ['a'] })), ['b'])
})

test('results are deterministic regardless of input order', () => {
  const list = Array.from({ length: 8 }, (_, i) =>
    task({ id: `d${i}`, dueDate: iso(5), priority: 'medium' }),
  )
  const forward = ids(planDay(list, { now: NOW }))
  const backward = ids(planDay([...list].reverse(), { now: NOW }))
  assert.deepEqual(forward, backward)
})

test('summarizePlan: over, within and uncertain budgets', () => {
  const t = (m) => task({ estimatedMinutes: m })
  assert.equal(summarizePlan([t(30), t(30)], 60).fit, 'within')
  const over = summarizePlan([t(30), t(40)], 60)
  assert.equal(over.fit, 'over')
  assert.equal(over.overBy, 10)
  assert.equal(summarizePlan([t(30), t(null)], 60).fit, 'uncertain')
  assert.equal(summarizePlan([], 60).fit, 'within')
})
