const DEV_ORIGIN = 'http://localhost:5173'

/**
 * Allowed browser origins from CORS_ORIGIN (comma separated). Trailing slashes are removed because
 * browsers send origins without them. Falls back to the local Vite dev server when unset.
 */
export function parseAllowedOrigins(value) {
  const list = String(value ?? '')
    .split(',')
    .map((item) => item.trim().replace(/\/+$/, ''))
    .filter(Boolean)
  return list.length > 0 ? list : [DEV_ORIGIN]
}
