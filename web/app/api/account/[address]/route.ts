import { rpc } from '@/lib/ledger'

export const dynamic = 'force-dynamic'

/**
 * What a browser needs to sign a vault transaction itself: the account's next sequence, a
 * LastLedgerSequence and a fee, read from the validated ledger. Plus what the account holds in the
 * vault asset and shares, so the page can show a position before and after. No key ever reaches here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ address: string }> },
) {
  const { address } = await params
  const url = new URL(request.url)
  const asset = url.searchParams.get('asset')
  const shares = url.searchParams.get('shares')
  const mpt = /^[A-Fa-f0-9]{48}$/
  if (
    !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(address) ||
    (asset && !mpt.test(asset)) ||
    (shares && !mpt.test(shares))
  )
    return Response.json({ error: 'Enter a valid XRPL address and MPT issuance ids.' }, { status: 400 })
  try {
    const info = await rpc('account_info', { account: address, ledger_index: 'validated' }).catch((e: Error) => {
      if (/actNotFound|Account not found/i.test(e.message)) return null
      throw e
    })
    if (!info)
      return Response.json({ error: 'This account does not exist on XRPL Devnet.' }, { status: 404, headers: { 'Cache-Control': 'no-store' } })
    const ledger = await rpc('ledger', { ledger_index: 'validated' })
    const fee = await rpc('fee', {})
    const holding = async (id: string | null) =>
      id
        ? ((await rpc('ledger_entry', { mptoken: { mpt_issuance_id: id, account: address }, ledger_index: 'validated' }).catch(() => null))?.node?.MPTAmount ?? '0')
        : null
    return Response.json(
      {
        address,
        sequence: Number(info.account_data.Sequence),
        balanceDrops: String(info.account_data.Balance),
        lastLedgerSequence: Number(ledger.ledger.ledger_index) + 20,
        // Open ledger fee in drops, never below the reference fee: a vault transaction is an ordinary one.
        fee: String(Math.max(Number(fee.drops?.open_ledger_fee ?? 12), Number(fee.drops?.base_fee ?? 10), 12)),
        assetHeld: await holding(asset),
        sharesHeld: await holding(shares),
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'The ledger could not be read.' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
