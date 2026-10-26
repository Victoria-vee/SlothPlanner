import { Router } from 'express'
import { ObjectId } from 'mongodb'
import { getDb } from './db.js'
import { serializeTask, validateNewTask, validateTaskUpdate } from './taskSchema.js'

const router = Router()

const tasksCollection = async () => (await getDb()).collection('tasks')

function parseId(req, res) {
  const { id } = req.params
  if (!ObjectId.isValid(id) || String(new ObjectId(id)) !== id.toLowerCase()) {
    res.status(400).json({ error: 'Invalid task id' })
    return null
  }
  return new ObjectId(id)
}

router.get('/', async (req, res) => {
  const tasks = await (await tasksCollection())
    .find()
    .sort({ createdAt: -1 })
    .limit(500)
    .toArray()
  res.json({ tasks: tasks.map(serializeTask) })
})

router.post('/', async (req, res) => {
  const { task, errors } = validateNewTask(req.body)
  if (errors) return res.status(400).json({ error: 'Validation failed', details: errors })

  const collection = await tasksCollection()
  const { insertedId } = await collection.insertOne(task)
  res.status(201).json({ task: serializeTask({ _id: insertedId, ...task }) })
})

router.patch('/:id', async (req, res) => {
  const _id = parseId(req, res)
  if (!_id) return

  const { update, errors } = validateTaskUpdate(req.body)
  if (errors) return res.status(400).json({ error: 'Validation failed', details: errors })

  const task = await (await tasksCollection()).findOneAndUpdate(
    { _id },
    { $set: update },
    { returnDocument: 'after' },
  )
  if (!task) return res.status(404).json({ error: 'Task not found' })
  res.json({ task: serializeTask(task) })
})

router.delete('/:id', async (req, res) => {
  const _id = parseId(req, res)
  if (!_id) return

  const { deletedCount } = await (await tasksCollection()).deleteOne({ _id })
  if (!deletedCount) return res.status(404).json({ error: 'Task not found' })
  res.status(204).end()
})

export default router
