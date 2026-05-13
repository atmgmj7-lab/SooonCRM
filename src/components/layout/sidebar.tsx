'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Megaphone, FileText, PhoneCall,
  Handshake, Users, BarChart2, Bot, Settings,
  PanelLeftClose, PanelLeftOpen, ListChecks, Inbox, RefreshCw,
  Shield, ChevronDown, GitMerge, Sliders,
} from 'lucide-react'

type NavLeaf = { href: string; label: string; icon: React.ElementType; accent?: boolean; indent?: boolean }
type NavGroup = { group: true; label: string; icon: React.ElementType; storageKey: string; children: NavLeaf[] }
type NavDivider = { divider: true }
type NavItem = NavLeaf | NavGroup | NavDivider

const NAV_ITEMS: NavItem[] = [
  { href: '/dashboard',   label: 'ダッシュボード',  icon: LayoutDashboard },
  { href: '/ads',         label: '広告マネージャー', icon: Megaphone },
  { href: '/leads',       label: 'リード管理',      icon: FileText },
  { href: '/leads/inbox', label: '受信リード',      icon: Inbox, indent: true },
  { href: '/calls',       label: 'コール履歴',      icon: PhoneCall },
  { href: '/list',        label: 'リスト情報',      icon: ListChecks },
  { href: '/deals',       label: '商談データ',      icon: Handshake },
  { href: '/customers',   label: '顧客データ',      icon: Users },
  { href: '/analytics',   label: 'アナリティクス',  icon: BarChart2 },
  { divider: true },
  { href: '/ai/agents',   label: 'AIエージェント',  icon: Bot, accent: true },
  {
    group: true,
    label: '管理',
    icon: Shield,
    storageKey: 'sidebar-admin-expanded',
    children: [
      { href: '/admin/field-mapping', label: 'フィールドマッピング', icon: Sliders, indent: true },
      { href: '/admin/relations',     label: 'リレーション管理',     icon: GitMerge, indent: true },
      { href: '/admin/sync',          label: '手動同期',             icon: RefreshCw, indent: true },
    ],
  },
  { href: '/settings', label: '設定', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [groupExpanded, setGroupExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    if (localStorage.getItem('sidebar-collapsed') === 'true') setCollapsed(true)
    const stored = localStorage.getItem('sidebar-group-expanded')
    if (stored) {
      try { setGroupExpanded(JSON.parse(stored)) } catch { /* ignore */ }
    }
  }, [])

  const toggle = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
      return next
    })
  }

  const toggleGroup = (key: string) => {
    setGroupExpanded((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      localStorage.setItem('sidebar-group-expanded', JSON.stringify(next))
      return next
    })
  }

  return (
    <aside
      style={{
        width: collapsed ? 52 : 200,
        transition: 'width 200ms ease',
        background: '#111827',
        borderRight: '1px solid #1F2937',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        flexShrink: 0,
        overflow: 'hidden',
      }}
    >
      {/* ロゴ + トグルボタン */}
      <div
        style={{
          padding: '10px 8px',
          borderBottom: '1px solid #1F2937',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'space-between',
          gap: 6,
          flexShrink: 0,
        }}
      >
        {/* ロゴアイコン: 常時表示 */}
        <div
          style={{
            width: 26, height: 26, borderRadius: 6,
            background: '#0D9488',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 9L6 2.5l2.5 4 1.5-2.5 1.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        {/* ロゴテキスト: 展開時のみ */}
        {!collapsed && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', letterSpacing: '-.2px', flex: 1 }}>
            GrowthHub
          </span>
        )}
        {/* トグルボタン */}
        <button
          type="button"
          onClick={toggle}
          title={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
          style={{
            width: 24, height: 24, borderRadius: 5,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6B7280', flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
      </div>

      {/* ナビゲーション */}
      <nav style={{ padding: '8px 6px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.map((item, i) => {
          if ('divider' in item) {
            return <div key={i} style={{ height: 1, background: '#1E293B', margin: '6px 0' }} />
          }

          // ── グループ（アコーディオン）
          if ('group' in item) {
            const Icon = item.icon
            const isOpen = !!groupExpanded[item.storageKey]
            const anyChildActive = item.children.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
            return (
              <div key={item.storageKey}>
                <button
                  type="button"
                  onClick={() => !collapsed && toggleGroup(item.storageKey)}
                  title={collapsed ? item.label : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 9,
                    padding: collapsed ? '8px 0' : '7px 10px',
                    justifyContent: collapsed ? 'center' : 'flex-start',
                    width: '100%',
                    borderRadius: 6,
                    fontSize: 12.5,
                    fontWeight: anyChildActive ? 500 : 400,
                    color: anyChildActive ? '#2DD4BF' : '#94A3B8',
                    background: anyChildActive && !isOpen ? 'rgba(13,148,136,.2)' : 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background .12s, color .12s',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                  }}
                  onMouseEnter={(e) => {
                    if (!anyChildActive || isOpen) {
                      e.currentTarget.style.background = 'rgba(255,255,255,.07)'
                      e.currentTarget.style.color = '#CBD5E1'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!anyChildActive || isOpen) {
                      e.currentTarget.style.background = 'transparent'
                      e.currentTarget.style.color = anyChildActive ? '#2DD4BF' : '#94A3B8'
                    }
                  }}
                >
                  <Icon size={14} style={{ flexShrink: 0 }} />
                  {!collapsed && (
                    <>
                      <span style={{ flex: 1 }}>{item.label}</span>
                      <ChevronDown
                        size={12}
                        style={{
                          flexShrink: 0,
                          transition: 'transform .15s',
                          transform: isOpen ? 'rotate(180deg)' : 'none',
                        }}
                      />
                    </>
                  )}
                </button>
                {/* 子メニュー */}
                {isOpen && !collapsed && item.children.map(child => {
                  const ChildIcon = child.icon
                  const isActive = pathname === child.href || pathname.startsWith(child.href + '/')
                  return (
                    <div key={child.href} style={{ position: 'relative', paddingLeft: 12 }}>
                      <div style={{
                        position: 'absolute', left: 18, top: 0, bottom: 0,
                        width: 1, background: '#1E293B',
                      }} />
                      <Link
                        href={child.href}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '5px 10px 5px 14px',
                          borderRadius: 6,
                          fontSize: 12,
                          fontWeight: isActive ? 500 : 400,
                          color: isActive ? '#2DD4BF' : '#64748B',
                          background: isActive ? 'rgba(13,148,136,.2)' : 'transparent',
                          textDecoration: 'none',
                          transition: 'background .12s, color .12s',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'rgba(255,255,255,.07)'
                            e.currentTarget.style.color = '#CBD5E1'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent'
                            e.currentTarget.style.color = '#64748B'
                          }
                        }}
                      >
                        <ChildIcon size={12} style={{ flexShrink: 0 }} />
                        <span style={{ flex: 1 }}>{child.label}</span>
                      </Link>
                    </div>
                  )
                })}
              </div>
            )
          }

          // ── 通常リーフ
          const Icon = item.icon
          const isIndent = 'indent' in item && item.indent
          const isActive = isIndent
            ? pathname === item.href || pathname.startsWith(item.href + '/')
            : pathname === item.href || (
                pathname.startsWith(item.href + '/') &&
                !NAV_ITEMS.some(n => 'indent' in n && n.indent && pathname.startsWith((n as NavLeaf).href))
              )
          return (
            <div
              key={item.href}
              style={{ position: 'relative', paddingLeft: isIndent && !collapsed ? 12 : 0 }}
            >
              {isIndent && !collapsed && (
                <div style={{
                  position: 'absolute', left: 18, top: 0, bottom: 0,
                  width: 1, background: '#1E293B',
                }} />
              )}
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: collapsed ? '8px 0' : isIndent ? '5px 10px 5px 14px' : '7px 10px',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  borderRadius: 6,
                  fontSize: isIndent ? 12 : 12.5,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? '#2DD4BF' : item.accent ? '#0D9488' : isIndent ? '#64748B' : '#94A3B8',
                  background: isActive ? 'rgba(13,148,136,.2)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'background .12s, color .12s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'rgba(255,255,255,.07)'
                    e.currentTarget.style.color = '#CBD5E1'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = item.accent ? '#0D9488' : isIndent ? '#64748B' : '#94A3B8'
                  }
                }}
              >
                <Icon size={isIndent ? 12 : 14} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
              </Link>
            </div>
          )
        })}
      </nav>

      {/* FM接続ステータス: 展開時のみ */}
      {!collapsed && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #1F2937', flexShrink: 0, background: '#111827' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981' }} />
            <span style={{ fontSize: 10.5, color: '#6B7280' }}>FileMaker API 接続中</span>
          </div>
          <div style={{ fontSize: 9.5, color: '#4B5563' }}>最終同期: 5分前</div>
        </div>
      )}
    </aside>
  )
}
