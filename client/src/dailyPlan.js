import { classifyDeadline, formatDue, explainFlag, isOpen } from './taskUtils.js'

// Daily selection logic. It reuses deadline classification but is deliberately separate from it:
// classification says what a deadline IS; this module decides what is worth considering today.

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS
export const MAX_SUGGESTIONS = 5
const MAX_SPARE_TIME = 2
const MAX_UNKNOWN_WITH_BUDGET = 2
const APPROACHING_DAYS = 7
const QUICK_MINUTES = 30
const LARGE_MINUTES = 120

const PRIORITY_SCORE = { high: 30, medium: 15, low: 0 }
const PRIORITY_LABEL = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' }

export function normalizeBudget(value) {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null
}

export function knownMinutes(task) {
  const m = task.estimatedMinutes
  return Number.isInteger(m) && m > 0 ? m : null
}

export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes} min`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}

function dueMs(task, now) {
  return task.dueDate ? new Date(task.dueDate).getTime() - now.getTime() : null
}

// tier 1: overdue; 2: due within 24h; 3: due within a week; 4: everything else (spare time)
function describe(task, now) {
  const state = classifyDeadline(task, now)
  const diff = dueMs(task, now)
  let tier = 4
  let urgency = 0
  if (state === 'overdue') {
    tier = 1
    urgency = 100 + Math.min(Math.abs(diff) / DAY_MS, 14)
  } else if (state === 'due_soon') {
    tier = 2
    urgency = 80 + (1 - diff / DAY_MS) * 20
  } else if (state === 'upcoming' && diff <= APPROACHING_DAYS * DAY_MS) {
    tier = 3
    urgency = 60 - (diff / DAY_MS) * 6
  }
  const minutes = knownMinutes(task)
  let score = urgency + (PRIORITY_SCORE[task.priority] ?? 0)
  if (task.status === 'in_progress') score += 10
  if (minutes !== null && minutes <= QUICK_MINUTES) score += 8
  if (minutes !== null && minutes >= LARGE_MINUTES) score -= 8
  return { task, state, tier, score, minutes }
}

function reasonsFor(item, now) {
  const { task, state, minutes } = item
  const reasons = []
  if (state === 'overdue') reasons.push('This is overdue.', explainFlag(task, now))
  else if (state === 'due_soon') reasons.push('Its deadline is approaching.', explainFlag(task, now))
  else if (item.tier === 3) reasons.push(`Its deadline is coming up: ${formatDue(task.dueDate)}.`)
  else if (state === 'upcoming') reasons.push(`Due ${formatDue(task.dueDate)}, so there is no rush today.`)
  else reasons.push('Consider this if you have spare time; no deadline is set.')
  if (PRIORITY_LABEL[task.priority]) reasons.push(`${PRIORITY_LABEL[task.priority]}.`)
  if (task.status === 'in_progress') reasons.push('You have already started it.')
  reasons.push(minutes !== null ? `Estimated ${formatMinutes(minutes)}.` : 'No time estimate yet.')
  return reasons.filter(Boolean)
}

// Stable ordering: tier, score, then earliest deadline, then id, so results never reshuffle by chance.
function compare(a, b) {
  if (a.tier !== b.tier) return a.tier - b.tier
  if (b.score !== a.score) return b.score - a.score
  const ad = a.task.dueDate ? new Date(a.task.dueDate).getTime() : Infinity
  const bd = b.task.dueDate ? new Date(b.task.dueDate).getTime() : Infinity
  if (ad !== bd) return ad - bd
  return String(a.task.id).localeCompare(String(b.task.id))
}

/**
 * Picks a short list of open tasks worth considering today. Never changes a task.
 * Options: budgetMinutes (optional), excludeIds (already planned or dismissed), now.
 * Returns { suggestions, notFit, budget, notes }.
 */
export function planDay(tasks, { budgetMinutes = null, excludeIds = [], now = new Date() } = {}) {
  const budget = normalizeBudget(budgetMinutes)
  const excluded = new Set(excludeIds)
  const ranked = tasks
    .filter((t) => isOpen(t) && !excluded.has(t.id))
    .map((t) => describe(t, now))
    .sort(compare)

  const suggestions = []
  const notFit = []
  const notes = []
  let used = 0
  let spare = 0
  let largeNonUrgent = 0
  let unknown = 0

  for (const item of ranked) {
    if (suggestions.length >= MAX_SUGGESTIONS) break
    const urgent = item.tier <= 2
    const large = item.minutes !== null && item.minutes >= LARGE_MINUTES
    if (item.tier === 4 && spare >= MAX_SPARE_TIME) continue
    if (!urgent && large && largeNonUrgent >= 1) continue

    let exceedsBudget = false
    if (budget !== null) {
      if (item.minutes === null) {
        if (unknown >= MAX_UNKNOWN_WITH_BUDGET || (used >= budget && suggestions.length > 0)) continue
      } else if (used + item.minutes > budget) {
        if (urgent && suggestions.length === 0) {
          exceedsBudget = true
        } else {
          if (urgent) notFit.push({ task: item.task, minutes: item.minutes, reasons: reasonsFor(item, now) })
          continue
        }
      }
    }

    suggestions.push({
      task: item.task,
      tier: item.tier,
      state: item.state,
      minutes: item.minutes,
      exceedsBudget,
      reasons: reasonsFor(item, now),
    })
    if (item.minutes !== null) used += item.minutes
    else unknown += 1
    if (item.tier === 4) spare += 1
    if (!urgent && large) largeNonUrgent += 1
  }

  if (suggestions[0]?.exceedsBudget) {
    notes.push(
      `Your most urgent task is estimated at ${formatMinutes(suggestions[0].minutes)}, which is more than your ${formatMinutes(budget)}. It is shown anyway so it is not hidden; you could do part of it or review its deadline.`,
    )
  }
  if (notFit.length > 0) {
    notes.push('Some urgent tasks did not fit your time, so they are listed separately below.')
  }
  return { suggestions, notFit, budget, notes }
}

/** Totals for the chosen plan. Tasks without an estimate are counted separately, never guessed. */
export function summarizePlan(tasks, budgetMinutes = null) {
  const budget = normalizeBudget(budgetMinutes)
  let known = 0
  let unknownCount = 0
  for (const task of tasks) {
    const m = knownMinutes(task)
    if (m === null) unknownCount += 1
    else known += m
  }
  let fit = null
  if (budget !== null) {
    if (known > budget) fit = 'over'
    else if (unknownCount > 0) fit = 'uncertain'
    else fit = 'within'
  }
  return { count: tasks.length, knownMinutes: known, unknownCount, budget, fit, overBy: fit === 'over' ? known - budget : 0 }
}
