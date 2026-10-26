const DEFAULT_BASE_URL = 'https://ollama.com'
const DEFAULT_TIMEOUT_MS = 60000

function aiError(status, message) {
  const error = new Error(message)
  error.status = status
  error.expose = true
  return error
}

export function isAiConfigured() {
  return Boolean(process.env.OLLAMA_API_KEY && process.env.OLLAMA_MODEL)
}

// Removes anything credential-like from provider text and keeps it short enough to log.
export function sanitizeProviderText(text, apiKey = process.env.OLLAMA_API_KEY) {
  let out = String(text ?? '')
  if (apiKey) out = out.split(apiKey).join('[redacted]')
  return out
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300)
}

// Reads Ollama's error body ({"error": "..."}) and returns a sanitized message.
export async function readProviderError(response) {
  try {
    const raw = await response.text()
    try {
      const parsed = JSON.parse(raw)
      const message = typeof parsed?.error === 'string' ? parsed.error : parsed?.error?.message
      if (message) return sanitizeProviderText(message)
    } catch {
      // not JSON; fall through to the raw text
    }
    return sanitizeProviderText(raw)
  } catch {
    return ''
  }
}

// Maps the provider's real status and message to a safe error for the frontend.
export function mapProviderError(status, providerMessage, model = process.env.OLLAMA_MODEL) {
  const mentionsModel = /model/i.test(providerMessage) && /(not found|not exist|unknown|invalid)/i.test(providerMessage)

  if (status === 401) {
    return aiError(502, 'The AI provider rejected the API key (HTTP 401). Check OLLAMA_API_KEY.')
  }
  if (status === 403) {
    return aiError(502, 'The AI provider denied access (HTTP 403). The key may lack access to this model or plan.')
  }
  if (status === 404 && mentionsModel) {
    return aiError(
      502,
      `The AI provider says model "${model}" was not found (HTTP 404). Check OLLAMA_MODEL against https://ollama.com/api/tags.`,
    )
  }
  if (status === 404) {
    return aiError(502, 'The AI provider returned HTTP 404. Check OLLAMA_BASE_URL.')
  }
  if (status === 429) {
    return aiError(429, 'The AI provider is busy or the usage limit was reached (HTTP 429). Try again later.')
  }
  return aiError(502, `The AI provider returned an error (HTTP ${status}). Please try again.`)
}

// Sends one non-streaming chat request to Ollama Cloud and returns the reply text.
// Errors carry a safe, user-facing message; the API key is never included in them.
export async function chat({ messages, format }) {
  if (!isAiConfigured()) {
    throw aiError(503, 'AI is not configured on the server (OLLAMA_API_KEY / OLLAMA_MODEL)')
  }

  const baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '')
  const timeoutMs = Number(process.env.OLLAMA_TIMEOUT_MS) || DEFAULT_TIMEOUT_MS

  let response
  try {
    response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.OLLAMA_MODEL,
        messages,
        format,
        stream: false,
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    })
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      throw aiError(504, 'The AI took too long to respond. Please try again.')
    }
    console.error('Ollama request failed:', error.name)
    throw aiError(502, 'Could not reach the AI provider. Please try again.')
  }

  if (!response.ok) {
    const providerMessage = await readProviderError(response)
    // Diagnostic only: status and sanitized provider error. Never the key, headers or user text.
    console.error(
      `Ollama error: status=${response.status} model=${process.env.OLLAMA_MODEL} message="${providerMessage}"`,
    )
    throw mapProviderError(response.status, providerMessage)
  }

  let data
  try {
    data = await response.json()
  } catch {
    throw aiError(502, 'The AI provider returned an unreadable response.')
  }

  const content = data?.message?.content
  if (typeof content !== 'string' || !content.trim()) {
    throw aiError(502, 'The AI returned an empty response. Please try again.')
  }
  return content
}
