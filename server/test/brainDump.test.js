import { afterEach, beforeEach, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_INPUT_LENGTH,
  MAX_SUGGESTIONS,
  buildMessages,
  extractTasks,
  parseSuggestions,
  validateBrainDumpBody,
} from '../brainDump.js'
import { chat } from '../ollama.js'

describe('validateBrainDumpBody', () => {
  test('accepts text and trims it', () => {
    assert.deepEqual(validateBrainDumpBody({ text: '  hi  ' }), { text: 'hi', timezone: 'UTC' })
  })

  test('accepts a valid timezone and rejects a bad one', () => {
    assert.equal(validateBrainDumpBody({ text: 'x', timezone: 'Europe/London' }).timezone, 'Europe/London')
    assert.ok(validateBrainDumpBody({ text: 'x', timezone: 'Mars/Base' }).error)
  })

  test('rejects missing, blank, non-string and oversized text', () => {
    assert.ok(validateBrainDumpBody({}).error)
    assert.ok(validateBrainDumpBody({ text: '   ' }).error)
    assert.ok(validateBrainDumpBody({ text: 5 }).error)
    assert.ok(validateBrainDumpBody({ text: 'a'.repeat(MAX_INPUT_LENGTH + 1) }).error)
    assert.ok(validateBrainDumpBody(null).error)
    assert.ok(validateBrainDumpBody([]).error)
  })
})

describe('parseSuggestions', () => {
  test('normalises a well-formed response', () => {
    const out = parseSuggestions(
      JSON.stringify({
        tasks: [
          { title: ' Send invoice ', notes: 'to Mossy', dueDate: '2026-10-25', priority: 'high', estimatedMinutes: 15 },
        ],
      }),
    )
    assert.deepEqual(out, [
      { title: 'Send invoice', description: 'to Mossy', priority: 'high', dueDate: '2026-10-25', estimatedMinutes: 15 },
    ])
  })

  test('keeps unknown values as null instead of inventing them', () => {
    const [task] = parseSuggestions(
      JSON.stringify({
        tasks: [{ title: 'A', notes: 5, dueDate: 'soon', priority: 'urgent', estimatedMinutes: 0 }],
      }),
    )
    assert.deepEqual(task, { title: 'A', description: '', priority: null, dueDate: null, estimatedMinutes: null })
  })

  test('rejects impossible calendar dates and trims datetimes to a date', () => {
    const out = parseSuggestions(
      JSON.stringify({
        tasks: [
          { title: 'A', notes: '', dueDate: '2026-02-31', priority: null, estimatedMinutes: null },
          { title: 'B', notes: '', dueDate: '2026-10-30T09:00:00Z', priority: null, estimatedMinutes: null },
        ],
      }),
    )
    assert.equal(out[0].dueDate, null)
    assert.equal(out[1].dueDate, '2026-10-30')
  })

  test('drops items without a usable title', () => {
    const out = parseSuggestions(JSON.stringify({ tasks: [{ title: '  ' }, null, 'x', { title: 'Keep' }] }))
    assert.deepEqual(out.map((t) => t.title), ['Keep'])
  })

  test('accepts a bare array and code-fenced JSON', () => {
    assert.equal(parseSuggestions('```json\n[{"title":"A"}]\n```').length, 1)
  })

  test('returns an empty list when there are no tasks', () => {
    assert.deepEqual(parseSuggestions('{"tasks": []}'), [])
  })

  test('caps the number of suggestions', () => {
    const tasks = Array.from({ length: MAX_SUGGESTIONS + 5 }, (_, i) => ({ title: `T${i}` }))
    assert.equal(parseSuggestions(JSON.stringify({ tasks })).length, MAX_SUGGESTIONS)
  })

  test('throws a 502 for malformed output', () => {
    for (const bad of ['not json', '{"foo": 1}', '"text"', '{"tasks": "x"}']) {
      assert.throws(() => parseSuggestions(bad), (e) => e.status === 502 && e.expose === true)
    }
  })
})

describe('extractTasks / buildMessages', () => {
  test('passes the date context and text to the model and parses the reply', async () => {
    let seen
    const chatFn = async (args) => {
      seen = args
      return '{"tasks":[{"title":"Renew passport","notes":"","dueDate":null,"priority":null,"estimatedMinutes":null}]}'
    }
    const now = new Date('2026-10-25T12:00:00Z')
    const out = await extractTasks('renew passport', 'Europe/London', { chatFn, now })

    assert.equal(out[0].title, 'Renew passport')
    assert.match(seen.messages[0].content, /2026-10-25/)
    assert.match(seen.messages[1].content, /renew passport/)
    assert.ok(seen.format.properties.tasks)
  })

  test('uses the date in the user time zone', () => {
    const now = new Date('2026-10-25T23:30:00Z')
    assert.match(buildMessages('x', 'Pacific/Auckland', now)[0].content, /2026-10-26/)
  })

  test('propagates provider errors', async () => {
    const chatFn = async () => {
      throw Object.assign(new Error('boom'), { status: 504 })
    }
    await assert.rejects(extractTasks('x', 'UTC', { chatFn }), { status: 504 })
  })
})

describe('ollama chat', () => {
  const realFetch = globalThis.fetch
  const saved = { ...process.env }
  const args = { messages: [{ role: 'user', content: 'hi' }], format: {} }

  beforeEach(() => {
    process.env.OLLAMA_API_KEY = 'test-secret-key'
    process.env.OLLAMA_MODEL = 'test-model'
    delete process.env.OLLAMA_BASE_URL
    console.error = () => {}
  })

  afterEach(() => {
    globalThis.fetch = realFetch
    process.env = { ...saved }
  })

  test('only reports "model not found" when the provider body says so', async () => {
    globalThis.fetch = async () =>
      new Response(JSON.stringify({ error: "model 'beam:cloud' not found" }), { status: 404 })
    await assert.rejects(chat(args), (e) => /model "test-model" was not found/.test(e.message))

    globalThis.fetch = async () => new Response('{"error":"route missing"}', { status: 404 })
    await assert.rejects(chat(args), (e) => {
      assert.ok(!/model/i.test(e.message))
      assert.match(e.message, /404/)
      return true
    })
  })

  test('distinguishes 401 from 403 and includes the HTTP status for other errors', async () => {
    globalThis.fetch = async () => new Response('{"error":"Unauthorized"}', { status: 401 })
    await assert.rejects(chat(args), (e) => /API key/.test(e.message) && /401/.test(e.message))
    globalThis.fetch = async () => new Response('{"error":"nope"}', { status: 403 })
    await assert.rejects(chat(args), (e) => /403/.test(e.message))
    globalThis.fetch = async () => new Response('{"error":"boom"}', { status: 500 })
    await assert.rejects(chat(args), (e) => /HTTP 500/.test(e.message))
  })

  test('sanitizes provider text and never logs the key or prompt', async () => {
    const logged = []
    console.error = (...a) => logged.push(a.join(' '))
    globalThis.fetch = async () =>
      new Response('{"error":"bad key test-secret-key Bearer abc.def"}', { status: 500 })
    await assert.rejects(
      chat({ messages: [{ role: 'user', content: 'MY PRIVATE BRAIN DUMP' }], format: {} }),
    )
    const output = logged.join('\n')
    assert.match(output, /status=500/)
    assert.ok(!output.includes('test-secret-key'))
    assert.ok(!output.includes('abc.def'))
    assert.ok(!output.includes('MY PRIVATE BRAIN DUMP'))
  })

  test('503 when not configured, without calling the network', async () => {
    delete process.env.OLLAMA_API_KEY
    globalThis.fetch = () => assert.fail('should not call fetch')
    await assert.rejects(chat(args), { status: 503 })
  })

  test('sends bearer auth and returns message.content', async () => {
    let request
    globalThis.fetch = async (url, init) => {
      request = { url, init }
      return Response.json({ message: { content: 'ok' } })
    }
    assert.equal(await chat(args), 'ok')
    assert.equal(request.url, 'https://ollama.com/api/chat')
    assert.equal(request.init.headers.Authorization, 'Bearer test-secret-key')
    const body = JSON.parse(request.init.body)
    assert.equal(body.model, 'test-model')
    assert.equal(body.stream, false)
  })

  test('maps provider failures to safe errors that never contain the key', async () => {
    const cases = [
      [401, 502],
      [404, 502],
      [429, 429],
      [500, 502],
    ]
    for (const [providerStatus, expected] of cases) {
      globalThis.fetch = async () => new Response('{"error":"secret test-secret-key"}', { status: providerStatus })
      await assert.rejects(chat(args), (e) => {
        assert.equal(e.status, expected)
        assert.ok(!e.message.includes('test-secret-key'))
        return true
      })
    }
  })

  test('maps timeouts to 504 and network failures to 502', async () => {
    globalThis.fetch = async () => {
      throw Object.assign(new Error('t'), { name: 'TimeoutError' })
    }
    await assert.rejects(chat(args), { status: 504 })

    globalThis.fetch = async () => {
      throw new TypeError('fetch failed')
    }
    await assert.rejects(chat(args), { status: 502 })
  })

  test('502 for non-JSON or empty provider replies', async () => {
    globalThis.fetch = async () => new Response('<html>', { status: 200 })
    await assert.rejects(chat(args), { status: 502 })
    globalThis.fetch = async () => Response.json({ message: { content: '  ' } })
    await assert.rejects(chat(args), { status: 502 })
  })
})
