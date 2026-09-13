import { decode } from 'ripple-binary-codec'
import { rpc } from '@/lib/ledger'
import { NETWORK } from '@/lib/config'

export const dynamic = 'force-dynamic'

/** The only transactions this relay forwards: the lender's own side of a fund. */
const RELAYED = new Set(['VaultDeposit', 'VaultWithdraw'])

/**
 * Relays a transaction the visitor signed in their own browser to XRPL Devnet. It receives a signed
 * blob, never a key, and it cannot sign anything: it checks the blob is a vault transaction for this
 * network, forwards it with `submit`, and returns the preliminary result and the hash. The final
 * result is read from a validated ledger through /api/tx/[hash].
 */
export async function POST(request: Request) {
  let blob = ''
  try {
    blob = String((await request.json())?.tx_blob ?? '')
  } catch {
    blob = ''
  }
  if (!/^[A-Fa-f0-9]+$/.test(blob) || blob.length > 4096)
    return Response.json({ error: 'Send a signed transaction blob as hex.' }, { status: 400 })
  let tx: Record<string, unknown>
  try {
    tx = decode(blob) as Record<string, unknown>
  } catch {
    return Response.json({ error: 'The blob does not decode as an XRPL transaction.' }, { status: 400 })
  }
  if (!RELAYED.has(String(tx.TransactionType)))
    return Response.json({ error: `This relay only forwards ${[...RELAYED].join(' and ')}.` }, { status: 400 })
  if (!tx.TxnSignature || !tx.SigningPubKey)
    return Response.json({ error: 'The transaction is not signed.' }, { status: 400 })
  // Networks with an id at or below 1024 must omit NetworkID; a blob carrying one is for another network.
  if (tx.NetworkID !== undefined && Number(tx.NetworkID) !== NETWORK.networkId)
    return Response.json({ error: 'This transaction is signed for another network.' }, { status: 400 })
  try {
    const r = await rpc('submit', { tx_blob: blob })
    return Response.json(
      {
        hash: String(r.tx_json?.hash ?? ''),
        engineResult: String(r.engine_result),
        engineMessage: String(r.engine_result_message ?? ''),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'The ledger could not be reached.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
