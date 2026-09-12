'use client'

import { useEffect, useRef, useState } from 'react'
import type { VaultSnapshot } from '@/lib/vault-ui'

export function useVault(id: string, holder?: string) {
  const [snapshot, setSnapshot] = useState<VaultSnapshot | null>(null)
  const [pending, setPending] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const refreshRef = useRef<() => void>(() => {})
  useEffect(() => {
    let disposed = false,
      inFlight = false
    let timer: ReturnType<typeof setTimeout>
    let controller: AbortController | null = null
    setSnapshot(null)
    setError(null)
    const read = async () => {
      if (disposed || inFlight) return
      clearTimeout(timer)
      if (document.hidden) {
        timer = setTimeout(read, 10_000)
        return
      }
      inFlight = true
      setPending(true)
      controller = new AbortController()
      const timeout = setTimeout(() => controller?.abort(), 20_000)
      try {
        const query = holder ? `?holder=${encodeURIComponent(holder)}` : ''
        const response = await fetch(
          `/api/vault/${encodeURIComponent(id)}${query}`,
          { cache: 'no-store', signal: controller.signal },
        )
        const data = await response.json()
        if (!response.ok)
          throw new Error(data.error || 'The ledger could not be read.')
        if (!disposed) {
          setSnapshot(data)
          setError(null)
        }
      } catch (e) {
        if (!disposed)
          setError(
            e instanceof Error && e.name !== 'AbortError'
              ? e.message
              : 'Ledger request timed out. Retry to read a new snapshot.',
          )
      } finally {
        clearTimeout(timeout)
        inFlight = false
        if (!disposed) {
          setPending(false)
          timer = setTimeout(read, 10_000)
        }
      }
    }
    refreshRef.current = () => {
      void read()
    }
    const visible = () => {
      if (!document.hidden) void read()
    }
    document.addEventListener('visibilitychange', visible)
    void read()
    return () => {
      disposed = true
      clearTimeout(timer)
      controller?.abort()
      document.removeEventListener('visibilitychange', visible)
      refreshRef.current = () => {}
    }
  }, [id, holder])
  return { snapshot, pending, error, refresh: () => refreshRef.current() }
}
