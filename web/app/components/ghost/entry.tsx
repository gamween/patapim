'use client'

import dynamic from 'next/dynamic'
import './ghost.css'

const GhostApp = dynamic(() => import('./ghost-app'), {
  ssr: false,
  loading: () => (
    <main className="ghost-root app">
      <div className="loader" role="status">
        <div className="loader-type">
          <h1>
            <span>PATAPIM</span>
          </h1>
          <p>
            <span>ASSETS IN MOTION</span>
          </p>
        </div>
      </div>
    </main>
  ),
})
export default function GhostEntry(props: {
  vaultId?: string
  holder?: string
  landing?: boolean
}) {
  return <GhostApp {...props} />
}
