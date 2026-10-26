const HOUR_MS = 60 * 60 * 1000
const DUE_SOON_MS = 24 * HOUR_MS

export const isOpen = (task) => task.status !== 'completed'

// Date-only deadlines are saved as 23:59 local time on that day (see SuggestionReview),
// so a deadline at exactly 23:59:00 is shown as a date without a time.
export function isDateOnly(date) {
  return date.getHours() === 23 && date.getMinutes() === 59 && date.getSeconds() === 0
}

function parseDue(dueDate) {
  if (!dueDate) return null
  const date = new Date(dueDate)
  return Number.isNaN(date.getTime()) ? null : date
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// Whole calendar days from today to the due date, in the local time zone (DST safe).
function calendarDaysFrom(now, due) {
  return Math.round((startOfDay(due) - startOfDay(now)) / (24 * HOUR_MS))
}

/**
 * Classifies one task into exactly one deadline state:
 * completed | no_deadline | overdue | due_soon | upcoming.
 * Overdue means the deadline instant has passed; due soon means it is within the next 24 hours.
 */
export function classifyDeadline(task, now = new Date()) {
  if (!isOpen(task)) return 'completed'
  const due = parseDue(task.dueDate)
  if (!due) return 'no_deadline'
  const diff = due.getTime() - now.getTime()
  if (diff < 0) return 'overdue'
  if (diff <= DUE_SOON_MS) return 'due_soon'
  return 'upcoming'
}

export function isAtRisk(task, now = new Date()) {
  const state = classifyDeadline(task, now)
  return state === 'overdue' || state === 'due_soon'
}

export function formatDue(dueDate) {
  const date = parseDue(dueDate)
  if (!date) return 'No deadline'
  const options = { weekday: 'short', month: 'short', day: 'numeric' }
  if (!isDateOnly(date)) {
    options.hour = 'numeric'
    options.minute = '2-digit'
  }
  return date.toLocaleString(undefined, options)
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

function describeDuration(ms) {
  const minutes = Math.round(ms / 60000)
  if (minutes < 60) return plural(Math.max(minutes, 1), 'minute')
  const hours = Math.round(ms / HOUR_MS)
  if (hours < 48) return plural(hours, 'hour')
  return plural(Math.round(hours / 24), 'day')
}

/** Short, factual sentence explaining why a flagged task is in Deadline Detective. */
export function explainFlag(task, now = new Date()) {
  const state = classifyDeadline(task, now)
  const due = parseDue(task.dueDate)
  if (!due) return ''
  const days = calendarDaysFrom(now, due)
  if (state === 'overdue') {
    if (isDateOnly(due)) {
      const when = days === -1 ? 'yesterday' : `${plural(-days, 'day')} ago`
      return days === 0
        ? 'Its deadline time today has passed and it is not completed.'
        : `Its deadline was ${when} and it is not completed.`
    }
    return `Its deadline passed ${describeDuration(now - due)} ago and it is not completed.`
  }
  if (state === 'due_soon') {
    if (isDateOnly(due)) {
      return days === 0
        ? 'Due today and not completed yet.'
        : 'Due tomorrow, within the next 24 hours, and not completed yet.'
    }
    return `Due in ${describeDuration(due - now)} and not completed yet.`
  }
  return ''
}

/** Suggestions only. Nothing here changes a task. */
export function suggestActions(task, now = new Date()) {
  const state = classifyDeadline(task, now)
  const working = task.status === 'in_progress'
  if (state === 'overdue') {
    return [
      'Check whether the deadline still applies, or whether the task is already done.',
      working ? 'Keep going: you have already started it.' : 'Pick the smallest next step and do just that.',
      'If it feels too big, break it into smaller steps.',
    ]
  }
  if (state === 'due_soon') {
    return [
      working ? 'Keep going: you have already started it.' : 'Start with a short first step.',
      'If time is tight, review whether the deadline is realistic.',
      'If it feels too big, break it into smaller steps.',
    ]
  }
  return []
}

const byDue = (a, b) => new Date(a.dueDate) - new Date(b.dueDate)

/** Groups open tasks so every task lands in at most one group. */
export function groupDeadlines(tasks, now = new Date()) {
  const groups = { overdue: [], dueSoon: [], noDeadline: [], upcoming: [] }
  for (const task of tasks) {
    const state = classifyDeadline(task, now)
    if (state === 'overdue') groups.overdue.push(task)
    else if (state === 'due_soon') groups.dueSoon.push(task)
    else if (state === 'no_deadline') groups.noDeadline.push(task)
    else if (state === 'upcoming') groups.upcoming.push(task)
  }
  groups.overdue.sort(byDue)
  groups.dueSoon.sort(byDue)
  groups.upcoming.sort(byDue)
  return groups
}

export function summarizeTasks(tasks, now = new Date()) {
  return {
    pending: tasks.filter(isOpen).length,
    completed: tasks.filter((t) => !isOpen(t)).length,
    atRisk: tasks.filter((t) => isAtRisk(t, now)).length,
  }
}

/** Deadline status badge for a task, or null when nothing needs flagging. Priority is never touched. */
export function deadlineTag(task, now = new Date()) {
  const state = classifyDeadline(task, now)
  if (state === 'overdue') return { label: 'Overdue', tone: 'overdue' }
  if (state === 'due_soon') return { label: 'Due soon', tone: 'soon' }
  return null
}
