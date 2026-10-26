import { useEffect, useState } from 'react'
import { getHealth } from '../api.js'

const labels = {
  loading: 'Checking backend…',
  connected: 'Backend connected',
  unavailable: 'Backend unavailable',
}

function BackendStatus() {
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const controller = new AbortController()

    getHealth({ signal: controller.signal })
      .then((data) => setStatus(data?.status === 'ok' ? 'connected' : 'unavailable'))
      .catch((error) => {
        if (error.name !== 'AbortError') setStatus('unavailable')
      })

    return () => controller.abort()
  }, [])

  return (
    <p className={`backend-status backend-${status}`} role="status">
      <span className="backend-dot" aria-hidden="true" />
      {labels[status]}
    </p>
  )
}

export default BackendStatus
