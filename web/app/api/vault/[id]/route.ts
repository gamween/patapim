import { presentVault } from '@/lib/vault-presentation'

export const dynamic = 'force-dynamic'
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const holder = new URL(request.url).searchParams.get('holder') || undefined
  if (
    !/^[A-Fa-f0-9]{64}$/.test(id) ||
    (holder && !/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(holder))
  ) {
    return Response.json(
      {
        error: 'Enter a 64-character vault ID and a valid XRPL holder address.',
      },
      { status: 400 },
    )
  }
  try {
    return Response.json(await presentVault(id, holder), {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'The ledger could not be read.',
      },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
