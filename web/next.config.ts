import type { NextConfig } from 'next'

// The repository has two lockfiles: the root one for the ledger scripts, this one for the app.
// Without an explicit root Next.js infers the parent directory and warns on every build.
const nextConfig: NextConfig = {
  turbopack: { root: __dirname },
}

export default nextConfig
