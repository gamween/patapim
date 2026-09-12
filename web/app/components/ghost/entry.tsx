'use client'

import dynamic from 'next/dynamic'
import { DEMO_VAULT } from '@/lib/config'

// Browser-only source uses matchMedia, WebGL, video and the local clock.
const GhostApp = dynamic(() => import('./ghost-app'), {
  ssr: false,
  loading: () => (
    <main className="page section">
      <h1>patapim</h1>
      <p className="lede" role="status">
        Loading the experience…
      </p>
      <div className="row hero-actions">
        <a className="btn" href="/product">
          Explore the product
        </a>
        <a className="btn btn-primary" href={`/vault/${DEMO_VAULT}`}>
          Open the live vault
        </a>
      </div>
    </main>
  ),
})

export default function GhostEntry() {
  return <GhostApp />
}
