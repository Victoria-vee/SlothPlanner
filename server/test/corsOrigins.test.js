import test from 'node:test'
import assert from 'node:assert/strict'
import { parseAllowedOrigins } from '../corsOrigins.js'

test('defaults to the local Vite dev server when CORS_ORIGIN is unset or blank', () => {
  assert.deepEqual(parseAllowedOrigins(undefined), ['http://localhost:5173'])
  assert.deepEqual(parseAllowedOrigins(''), ['http://localhost:5173'])
  assert.deepEqual(parseAllowedOrigins(' , '), ['http://localhost:5173'])
})

test('accepts several origins, trims spaces and strips trailing slashes', () => {
  assert.deepEqual(
    parseAllowedOrigins('https://braindump.onrender.com/, http://localhost:5173 '),
    ['https://braindump.onrender.com', 'http://localhost:5173'],
  )
})
