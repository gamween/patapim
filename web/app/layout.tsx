import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'patapim, securities lending native on the XRP Ledger',
  description:
    'Eligible holders lend tokenised securities from a fixed-term vault through a lending agent, with the ledger enforcing the indemnity. Built on XLS-65 and XLS-66.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
