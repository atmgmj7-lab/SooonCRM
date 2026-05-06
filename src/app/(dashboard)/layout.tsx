import { Sidebar } from '@/components/layout/sidebar'
import { Header } from '@/components/layout/header'

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <Header />
      <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden', gap: 0 }}>
        <Sidebar />
        <main
          style={{
            flex: 1,
            minHeight: 0,
            boxSizing: 'border-box',
            overflow: 'auto',
            display: 'flex',
            flexDirection: 'column',
            margin: 0,
            padding: 0,
          }}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
