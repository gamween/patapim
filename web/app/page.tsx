import GhostEntry from '@/app/components/ghost/entry'
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; holder?: string }>
}) {
  const { view, holder } = await searchParams
  return (
    <GhostEntry
      holder={holder}
      initialSection={view === 'about' ? 'about' : 'vault'}
    />
  )
}
