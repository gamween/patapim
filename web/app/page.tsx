import GhostEntry from '@/app/components/ghost/entry'
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ holder?: string }>
}) {
  const { holder } = await searchParams
  return <GhostEntry holder={holder} landing />
}
