import { randomUUID } from 'node:crypto'

export const PRIORITIES = ['low', 'medium', 'high']
export const STATUSES = ['pending', 'in_progress', 'completed']

const CREATE_FIELDS = [
  'title',
  'description',
  'priority',
  'status',
  'dueDate',
  'estimatedMinutes',
  'metadata',
  'steps',
]

export const MAX_STEPS = 10
export const MAX_STEP_LENGTH = 200

const normalizeStepText = (text) => text.trim().replace(/\s+/g, ' ').toLowerCase()

// Validates and cleans a steps array: trims text, drops case-insensitive duplicates, assigns ids.
export function validateSteps(input) {
  if (!Array.isArray(input)) return { error: 'steps must be an array' }
  if (input.length > MAX_STEPS) return { error: `steps must have ${MAX_STEPS} items or fewer` }

  const seen = new Set()
  const steps = []
  for (const raw of input) {
    if (!isPlainObject(raw) || typeof raw.text !== 'string' || !raw.text.trim()) {
      return { error: 'each step needs non-empty text' }
    }
    const text = raw.text.trim().replace(/\s+/g, ' ')
    if (text.length > MAX_STEP_LENGTH) {
      return { error: `step text must be ${MAX_STEP_LENGTH} characters or fewer` }
    }
    if (raw.done !== undefined && typeof raw.done !== 'boolean') {
      return { error: 'step done must be true or false' }
    }
    const minutes = raw.estimatedMinutes ?? null
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) {
      return { error: 'step estimatedMinutes must be an integer from 1 to 1440, or null' }
    }
    const key = normalizeStepText(text)
    if (seen.has(key)) continue
    seen.add(key)
    steps.push({
      id: typeof raw.id === 'string' && raw.id && raw.id.length <= 64 ? raw.id : randomUUID(),
      text,
      done: raw.done === true,
      estimatedMinutes: minutes,
    })
  }
  return { value: steps }
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Validates a single field. Returns { value } or { error }.
function validateField(field, input) {
  switch (field) {
    case 'title': {
      if (typeof input !== 'string' || !input.trim()) {
        return { error: 'title must be a non-empty string' }
      }
      if (input.trim().length > 200) return { error: 'title must be 200 characters or fewer' }
      return { value: input.trim() }
    }
    case 'description': {
      if (typeof input !== 'string') return { error: 'description must be a string' }
      if (input.length > 5000) return { error: 'description must be 5000 characters or fewer' }
      return { value: input.trim() }
    }
    case 'priority': {
      if (!PRIORITIES.includes(input)) {
        return { error: `priority must be one of: ${PRIORITIES.join(', ')}` }
      }
      return { value: input }
    }
    case 'status': {
      if (!STATUSES.includes(input)) {
        return { error: `status must be one of: ${STATUSES.join(', ')}` }
      }
      return { value: input }
    }
    case 'dueDate': {
      if (input === null) return { value: null }
      const date = typeof input === 'string' ? new Date(input) : null
      if (!date || Number.isNaN(date.getTime())) {
        return { error: 'dueDate must be an ISO 8601 date string or null' }
      }
      return { value: date }
    }
    case 'estimatedMinutes': {
      if (input === null) return { value: null }
      if (!Number.isInteger(input) || input < 1 || input > 10080) {
        return { error: 'estimatedMinutes must be an integer from 1 to 10080, or null' }
      }
      return { value: input }
    }
    case 'steps':
      return validateSteps(input)
    case 'metadata': {
      if (!isPlainObject(input)) return { error: 'metadata must be an object' }
      return { value: input }
    }
    default:
      return { error: `${field} is not a supported field` }
  }
}

function validate(body, allowedFields) {
  if (!isPlainObject(body)) return { errors: ['Request body must be a JSON object'] }

  const errors = []
  const values = {}

  for (const key of Object.keys(body)) {
    if (!allowedFields.includes(key)) {
      errors.push(`${key} is not a supported field`)
      continue
    }
    const result = validateField(key, body[key])
    if (result.error) errors.push(result.error)
    else values[key] = result.value
  }

  return { errors, values }
}

export function validateNewTask(body) {
  const { errors, values } = validate(body, CREATE_FIELDS)
  if (errors.length) return { errors }

  if (values.title === undefined) return { errors: ['title is required'] }

  const now = new Date()
  return {
    task: {
      title: values.title,
      description: values.description ?? '',
      priority: values.priority ?? 'medium',
      status: values.status ?? 'pending',
      dueDate: values.dueDate ?? null,
      estimatedMinutes: values.estimatedMinutes ?? null,
      // Free-form bag for future features (e.g. AI planning notes, source text).
      metadata: values.metadata ?? {},
      steps: values.steps ?? [],
      createdAt: now,
      updatedAt: now,
    },
  }
}

export function validateTaskUpdate(body) {
  const { errors, values } = validate(body, CREATE_FIELDS)
  if (errors.length) return { errors }
  if (Object.keys(values).length === 0) {
    return { errors: [`Provide at least one of: ${CREATE_FIELDS.join(', ')}`] }
  }
  return { update: { ...values, updatedAt: new Date() } }
}

export function serializeTask(doc) {
  const { _id, ...rest } = doc
  return { id: _id.toString(), ...rest }
}
