import { useMemo, useSyncExternalStore } from 'react'
import { parseRoute } from '../routes.js'

const subscribe = (callback) => {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}

// Reads the current location hash, so back/forward and typed URLs always update the page.
export function useRoute() {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  return useMemo(() => parseRoute(hash), [hash])
}
