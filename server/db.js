import dns from 'node:dns'
import { MongoClient } from 'mongodb'

// Node 20.12+ can load .env itself; a missing file is fine (real env vars still work).
try {
  process.loadEnvFile()
} catch {
  // no .env file
}

// Some local resolvers/VPNs refuse the SRV lookups used by mongodb+srv:// URIs.
// Optionally point Node at other DNS servers, e.g. MONGODB_DNS_SERVERS=8.8.8.8,1.1.1.1
if (process.env.MONGODB_DNS_SERVERS) {
  dns.setServers(process.env.MONGODB_DNS_SERVERS.split(',').map((s) => s.trim()).filter(Boolean))
}

let client = null
let connecting = null

function httpError(status, message) {
  const error = new Error(message)
  error.status = status
  return error
}

export function isDbConfigured() {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_DB_NAME)
}

// Returns the shared database handle, opening one client on first use and reusing it afterwards.
export async function getDb() {
  if (!isDbConfigured()) {
    throw httpError(503, 'Database is not configured')
  }

  if (!client) {
    if (!connecting) {
      const candidate = new MongoClient(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
      })
      connecting = candidate
        .connect()
        .then(() => {
          client = candidate
        })
        .catch((error) => {
          // Log the message only; it does not include the connection string.
          console.error('MongoDB connection failed:', error.message)
          candidate.close().catch(() => {})
          throw httpError(503, 'Database is unavailable')
        })
        .finally(() => {
          connecting = null
        })
    }
    await connecting
  }

  return client.db(process.env.MONGODB_DB_NAME)
}

// Reports 'connected' only after a successful ping.
export async function getDbStatus() {
  if (!isDbConfigured()) return 'not_configured'
  try {
    const db = await getDb()
    await db.command({ ping: 1 })
    return 'connected'
  } catch {
    return 'unavailable'
  }
}

export async function closeDb() {
  if (client) {
    await client.close()
    client = null
  }
}
