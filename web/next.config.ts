import type { NextConfig } from 'next'

// The repository has two lockfiles: the root one for the ledger scripts, this one for the app.
// Without an explicit root Next.js infers the parent directory and warns on every build.
const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    // xrpl-connect.mjs bundles crypto-js behind UMD wrappers:
    //   typeof exports == "object" ? CommonJS : define(["./core"], ...)
    // The CommonJS branch always runs, but Turbopack still resolves the dead AMD "./core" and fails
    // the build. Ignore that one issue, in that one file; a real missing module elsewhere still fails.
    ignoreIssue: [
      {
        path: '**/node_modules/xrpl-connect/xrpl-connect.mjs',
        title: /Module not found/,
      },
    ],
  },
}

export default nextConfig
