// Pure helpers for task steps (Lazy Mode). Steps live on the task as
// [{ id, text, done, estimatedMinutes }]; older tasks have no `steps` field at all.

export const MAX_STEPS = 10
export const MAX_STEP_LENGTH = 200

const normalize = (text) => text.replace(/\s+/g, ' ').trim().toLowerCase()

export const getSteps = (task) => (Array.isArray(task.steps) ? task.steps : [])

export function stepProgress(steps) {
  const done = steps.filter((s) => s.done).length
  return { done, total: steps.length }
}

// Flips one step and leaves every other step (and its id and order) untouched.
export function toggleStep(steps, id) {
  return steps.map((s) => (s.id === id ? { ...s, done: !s.done } : s))
}

/**
 * Appends accepted drafts to existing steps. Blank and duplicate text (against existing steps
 * or each other) is skipped, existing steps are never changed, and the total stays within MAX_STEPS.
 * Returns { steps, added, skipped }.
 */
export function mergeSteps(existing, drafts) {
  const seen = new Set(existing.map((s) => normalize(s.text)))
  const merged = [...existing]
  let added = 0
  let skipped = 0
  for (const draft of drafts) {
    const text = (draft.text ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_STEP_LENGTH)
    const key = normalize(text)
    if (!text || seen.has(key) || merged.length >= MAX_STEPS) {
      skipped += 1
      continue
    }
    seen.add(key)
    merged.push({ text, done: false, estimatedMinutes: draft.minutes ?? null })
    added += 1
  }
  return { steps: merged, added, skipped }
}
