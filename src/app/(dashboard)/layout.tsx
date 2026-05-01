import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-gray-50)' }}>
      <Sidebar />
      <Header />
      <main
        className="overflow-auto"
        style={{
          marginLeft: 220,
          paddingTop: 56,
          minHeight: '100vh',
        }}
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  )
}
