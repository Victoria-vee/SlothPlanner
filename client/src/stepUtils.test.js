import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_STEPS, getSteps, mergeSteps, stepProgress, toggleStep } from './stepUtils.js'

const step = (id, text, done = false) => ({ id, text, done, estimatedMinutes: null })

test('tasks without a steps field (older tasks) read as having no steps', () => {
  assert.deepEqual(getSteps({ title: 'x' }), [])
  assert.deepEqual(getSteps({ steps: null }), [])
  assert.deepEqual(getSteps({ steps: [step('1', 'a')] }).length, 1)
})

test('accepting appends new steps, unchecked, and leaves existing steps untouched', () => {
  const existing = [step('1', 'Open file', true)]
  const { steps, added, skipped } = mergeSteps(existing, [{ text: ' Write intro ', minutes: 10 }, { text: 'Review' }])
  assert.equal(added, 2)
  assert.equal(skipped, 0)
  assert.deepEqual(steps[0], existing[0])
  assert.deepEqual(steps.slice(1).map((s) => [s.text, s.done]), [['Write intro', false], ['Review', false]])
  assert.equal(steps[1].estimatedMinutes, 10)
  assert.equal(steps[2].estimatedMinutes, null)
})

test('saving the same suggestions twice does not duplicate steps', () => {
  const drafts = [{ text: 'Open file' }, { text: 'Write intro' }]
  const first = mergeSteps([], drafts).steps.map((s, i) => ({ ...s, id: String(i) }))
  const second = mergeSteps(first, drafts)
  assert.equal(second.added, 0)
  assert.equal(second.skipped, 2)
  assert.equal(second.steps.length, 2)
})

test('duplicates are detected ignoring case and spacing, and blanks are skipped', () => {
  const { steps, added, skipped } = mergeSteps([step('1', 'Call Sam')], [
    { text: 'call   sam' },
    { text: '   ' },
    { text: 'Email Alex' },
    { text: 'email alex' },
  ])
  assert.equal(added, 1)
  assert.equal(skipped, 3)
  assert.equal(steps.length, 2)
})

test('total steps never exceed the limit', () => {
  const existing = Array.from({ length: MAX_STEPS - 1 }, (_, i) => step(String(i), `s${i}`))
  const { steps, added, skipped } = mergeSteps(existing, [{ text: 'a' }, { text: 'b' }])
  assert.equal(steps.length, MAX_STEPS)
  assert.equal(added, 1)
  assert.equal(skipped, 1)
})

test('checking and unchecking flips only the chosen step', () => {
  const steps = [step('1', 'a'), step('2', 'b')]
  const checked = toggleStep(steps, '2')
  assert.deepEqual(checked.map((s) => s.done), [false, true])
  assert.deepEqual(checked.map((s) => s.id), ['1', '2'])
  assert.deepEqual(toggleStep(checked, '2').map((s) => s.done), [false, false])
  assert.deepEqual(steps.map((s) => s.done), [false, false]) // input is not mutated
})

test('toggling an unknown id changes nothing', () => {
  const steps = [step('1', 'a')]
  assert.deepEqual(toggleStep(steps, 'nope'), steps)
})

test('progress counts checked steps; finishing all steps says nothing about the task', () => {
  assert.deepEqual(stepProgress([]), { done: 0, total: 0 })
  const all = [step('1', 'a', true), step('2', 'b', true)]
  assert.deepEqual(stepProgress(all), { done: 2, total: 2 })
  assert.equal('status' in stepProgress(all), false)
})
