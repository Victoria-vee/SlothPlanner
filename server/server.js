import express from 'express'
import cors from 'cors'
import { getDbStatus } from './db.js'
import tasksRouter from './tasksRouter.js'
import brainDumpRouter from './brainDump.js'
import lazyModeRouter from './lazyMode.js'
import { parseAllowedOrigins } from './corsOrigins.js'

const app = express()
const port = process.env.PORT || 3000

app.use(cors({ origin: parseAllowedOrigins(process.env.CORS_ORIGIN) }))
app.use(express.json())

app.get('/api/health', async (req, res) => {
  res.json({ status: 'ok', app: 'Sloth Planner', database: await getDbStatus() })
})

app.use('/api/tasks', tasksRouter)
app.use('/api/brain-dump', brainDumpRouter)
app.use('/api/lazy-mode', lazyModeRouter)

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' })
})

// Express identifies error handlers by their four-argument signature.
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500
  const showMessage = status < 500 || status === 503 || err.expose === true
  if (!showMessage) console.error(err)
  res.status(status).json({
    error: showMessage ? err.message : 'Internal server error',
  })
})

// Render requires listening on 0.0.0.0 so the platform's proxy can reach the service.
app.listen(port, '0.0.0.0', () => {
  console.log(`BrainDump server listening on port ${port}`)
})
