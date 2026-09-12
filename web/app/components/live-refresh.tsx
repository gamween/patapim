'use client'

import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'

/** Refresh the server-rendered view; the browser never derives phases or reads XRPL. */
export default function LiveRefresh() {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  useEffect(() => {
    const refresh = () => {
      if (!pending && document.visibilityState === 'visible') {
        startTransition(() => router.refresh())
      }
    }
    const interval = window.setInterval(refresh, 10_000)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [router, pending])
  return (
    <div className="refresh">
      <span role="status">
        {pending
          ? 'Reading the ledger…'
          : 'Ledger snapshot · refreshes every 10s'}
      </span>
      <button
        className="btn"
        disabled={pending}
        onClick={() => startTransition(() => router.refresh())}
      >
        Refresh ledger
      </button>
    </div>
  )
}
