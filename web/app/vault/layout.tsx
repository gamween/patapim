import SiteShell from '@/app/components/site-shell'

export default function Layout({ children }: { children: React.ReactNode }) {
  return <SiteShell>{children}</SiteShell>
}
