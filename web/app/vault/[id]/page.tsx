import GhostEntry from '@/app/components/ghost/entry'
export default async function VaultPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ holder?: string }>
}) {
  const { id } = await params
  const { holder } = await searchParams
  return (
    <GhostEntry
      key={`${id}:${holder ?? ''}`}
      vaultId={id}
      holder={holder}
      skipIntro
    />
  )
}
