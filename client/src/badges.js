import { deadlineTag } from './taskUtils.js'

const PRIORITY_LABELS = { high: 'High priority', medium: 'Medium priority', low: 'Low priority' }

/**
 * The two badges for a task. Deadline status (Overdue / Due soon) and priority are separate
 * facts: an overdue task keeps its stored priority and shows both.
 */
export function taskBadges(task, now = new Date()) {
  const priority = PRIORITY_LABELS[task.priority]
  return {
    deadline: deadlineTag(task, now),
    priority: priority ? { value: task.priority, label: priority } : null,
  }
}
