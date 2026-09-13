import { readTransaction } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

/** The validated outcome of a transaction: 202 while it is not in a validated ledger yet. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash } = await params
  if (!/^[A-Fa-f0-9]{64}$/.test(hash))
    return Response.json({ error: 'Enter a 64-character transaction hash.' }, { status: 400 })
  try {
    const tx = await readTransaction(hash.toUpperCase())
    return Response.json(tx ?? { pending: true }, {
      status: tx ? 200 : 202,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'The ledger could not be read.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
