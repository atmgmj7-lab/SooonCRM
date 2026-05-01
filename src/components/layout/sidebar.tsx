'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  Bot,
  Users,
  ListChecks,
  Phone,
  Handshake,
  Megaphone,
  Settings,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useState } from 'react'

type NavItem = {
  label: string
  href?: string
  icon?: React.ReactNode
  children?: { label: string; href: string }[]
}

const navItems: NavItem[] = [
  {
    label: 'ダッシュボード',
    icon: <LayoutDashboard size={15} />,
    children: [
      { label: 'KPIトップ', href: '/dashboard' },
      { label: 'AIステータス', href: '/dashboard/ai-status' },
    ],
  },
  {
    label: '広告',
    icon: <Megaphone size={15} />,
    children: [
      { label: '広告マネージャー', href: '/ads' },
      { label: 'キャンペーン', href: '/ads/campaigns' },
      { label: 'クリエイティブ', href: '/ads/creatives' },
    ],
  },
  {
    label: 'リード',
    icon: <ListChecks size={15} />,
    children: [
      { label: 'Webhook受信', href: '/leads' },
      { label: 'リスト一覧', href: '/list' },
    ],
  },
  {
    label: 'コール',
    icon: <Phone size={15} />,
    href: '/calls',
  },
  {
    label: 'リスト情報',
    icon: <Users size={15} />,
    children: [
      { label: '顧客一覧', href: '/customers' },
    ],
  },
  {
    label: '商談情報',
    icon: <Handshake size={15} />,
    href: '/deals',
  },
  {
    label: 'AI',
    icon: <Bot size={15} />,
    children: [
      { label: 'エージェント', href: '/ai/agents' },
      { label: '指示一覧', href: '/ai/instructions' },
    ],
  },
  {
    label: '設定',
    icon: <Settings size={15} />,
    children: [
      { label: '指標マスタ', href: '/settings/metrics' },
      { label: 'ステータスマスタ', href: '/settings/statuses' },
      { label: 'FMマッピング', href: '/settings/fm-mapping' },
      { label: 'FM同期ログ', href: '/settings/fm-sync-log' },
      { label: 'ユーザー', href: '/settings/users' },
      { label: 'CSVインポート', href: '/admin/import-leads' },
    ],
  },
]

function NavGroup({ item }: { item: NavItem }) {
  const pathname = usePathname()
  const isChildActive = item.children?.some((c) => pathname.startsWith(c.href))
  const [open, setOpen] = useState(isChildActive ?? true)

  if (item.href) {
    const active = pathname === item.href
    return (
      <Link
        href={item.href}
        className={[
          'flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] transition-colors duration-150',
          active
            ? 'bg-[var(--color-blue)] text-white'
            : 'text-white/70 hover:text-white hover:bg-[var(--color-navy-mid)]',
        ].join(' ')}
      >
        {item.icon}
        {item.label}
      </Link>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[13px] text-white/70 hover:text-white hover:bg-[var(--color-navy-mid)] transition-colors duration-150"
      >
        {item.icon}
        <span className="flex-1 text-left">{item.label}</span>
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>
      {open && item.children && (
        <div className="ml-6 mt-0.5 flex flex-col gap-0.5">
          {item.children.map((child) => {
            const active = pathname === child.href || pathname.startsWith(child.href + '/')
            return (
              <Link
                key={child.href}
                href={child.href}
                className={[
                  'block px-3 py-1.5 rounded-md text-[12px] transition-colors duration-150',
                  active
                    ? 'text-white bg-[var(--color-navy-mid)]'
                    : 'text-white/60 hover:text-white hover:bg-[var(--color-navy-mid)]',
                ].join(' ')}
              >
                {child.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function Sidebar() {
  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col"
      style={{ width: 220, backgroundColor: 'var(--color-navy)' }}
    >
      <div className="px-4 py-4 border-b border-white/10">
        <span className="text-white font-semibold text-[15px]">GrowthHub</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3 flex flex-col gap-0.5">
        {navItems.map((item) => (
          <NavGroup key={item.label} item={item} />
        ))}
      </nav>
    </aside>
  )
}
