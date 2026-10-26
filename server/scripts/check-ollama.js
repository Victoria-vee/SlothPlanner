// Checks the configured Ollama Cloud model without printing the API key.
// Usage (from server/): npm run check:ollama
import { sanitizeProviderText } from '../ollama.js'

try {
  process.loadEnvFile()
} catch {
  // no .env file; real environment variables still apply
}

const baseUrl = (process.env.OLLAMA_BASE_URL || 'https://ollama.com').replace(/\/+$/, '')
const model = process.env.OLLAMA_MODEL
const apiKey = process.env.OLLAMA_API_KEY

console.log('Base URL      :', baseUrl)
console.log('Model         :', model ? JSON.stringify(model) : '(not set)')
console.log('API key       :', apiKey ? `set (${apiKey.length} characters)` : '(not set)')

if (!model || !apiKey) {
  console.log('\nResult: OLLAMA_MODEL and OLLAMA_API_KEY must both be set in server/.env')
  process.exit(1)
}

async function call(label, url, init) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(30000) })
    const text = await res.text()
    return { res, text }
  } catch (error) {
    console.log(`${label}: network error (${error.name})`)
    return null
  }
}

// 1. Model list
const tags = await call('GET /api/tags', `${baseUrl}/api/tags`, {
  headers: { Authorization: `Bearer ${apiKey}` },
})
if (tags) {
  console.log(`\nGET /api/tags -> HTTP ${tags.res.status}`)
  if (tags.res.ok) {
    let available = []
    try {
      available = (JSON.parse(tags.text).models || []).map((m) => m.name || m.model).filter(Boolean)
    } catch {
      console.log('Could not parse the model list.')
    }
    console.log(`Models returned: ${available.length}`)
    const exact = available.includes(model)
    console.log(`Configured model listed exactly: ${exact ? 'YES' : 'NO'}`)
    if (!exact) {
      const base = model.split(':')[0].toLowerCase()
      const near = available.filter((m) => m.toLowerCase().includes(base))
      if (near.length) console.log('Similar names:', near.join(', '))
      console.log('Available models:', available.join(', ') || '(none)')
    }
  } else {
    console.log('Error:', sanitizeProviderText(tags.text, apiKey))
  }
}

// 2. Minimal chat request with the configured model (no user data)
const chat = await call('POST /api/chat', `${baseUrl}/api/chat`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model,
    messages: [{ role: 'user', content: 'Reply with the single word OK.' }],
    stream: false,
  }),
})
if (chat) {
  console.log(`\nPOST /api/chat -> HTTP ${chat.res.status}`)
  if (chat.res.ok) {
    let reply = ''
    try {
      reply = JSON.parse(chat.text)?.message?.content ?? ''
    } catch {
      // ignore
    }
    console.log('Model replied:', sanitizeProviderText(reply, apiKey).slice(0, 80) || '(empty)')
  } else {
    let message = chat.text
    try {
      const parsed = JSON.parse(chat.text)
      message = typeof parsed.error === 'string' ? parsed.error : JSON.stringify(parsed.error)
    } catch {
      // keep raw text
    }
    console.log('Provider error:', sanitizeProviderText(message, apiKey))
  }
}
