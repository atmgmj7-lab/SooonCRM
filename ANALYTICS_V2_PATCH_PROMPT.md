# アナリティクス v2 追加修正プロンプト（Claude Code用）

> **前提**: v1（9ファイル）は実装済み・ビルド成功済み。このプロンプトは差分パッチ指示のみ。
> **作業スコープ**: ① サイドバー折りたたみ ② 期間フィルタ統一 ③ 広告チェックボックス比較 ④ グラフON/OFF ⑤ スプレッドシート全指標追加

---

## 修正 1: サイドバー折りたたみ（Claude.ai完全再現）

**ファイル**: `src/components/layout/sidebar.tsx`

### 挙動仕様（Claude.aiのサイドバーと同一）

- デフォルト: **展開状態**（幅 `200px`）
- 折りたたみ時: **アイコンのみ**（幅 `52px`）、ラベル・バッジ非表示
- トグルボタン: サイドバー **最上部**（ロゴの右横）に配置
  - 展開時: `←`（ChevronsLeft / PanelLeftClose アイコン）
  - 折りたたみ時: `→`（ChevronsRight / PanelLeftOpen アイコン）
- **アニメーション**: `transition: width 200ms ease` でスライド
- ホバー時: 折りたたみ状態でもアイコンにツールチップ（ラベルテキスト）を表示
- 状態は `localStorage.setItem('sidebar-collapsed', ...)` で永続化

### 実装コード（完全版）

```tsx
'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Megaphone, FileText, PhoneCall,
  Handshake, Users, BarChart2, Bot, Settings,
  PanelLeftClose, PanelLeftOpen
} from 'lucide-react'

const NAV_ITEMS = [
  { href: '/dashboard',   label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/ads',         label: '広告マネージャー', icon: Megaphone },
  { href: '/leads',       label: 'リード管理',     icon: FileText,  badge: true },
  { href: '/calls',       label: '顧客 & コール',  icon: PhoneCall },
  { href: '/deals',       label: '商談データ',     icon: Handshake },
  { href: '/customers',   label: '顧客データ',     icon: Users,     sub: true },
  { href: '/reports',     label: '集計',           icon: BarChart2 },
  { href: '/analytics',   label: 'アナリティクス', icon: BarChart2 },  // ← 追加済み
  { divider: true },
  { href: '/ai',          label: 'AIエージェント', icon: Bot,       accent: true },
  { href: '/settings',    label: '設定',           icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('sidebar-collapsed') === 'true'
    }
    return false
  })

  const toggle = () => {
    setCollapsed(prev => {
      const next = !prev
      localStorage.setItem('sidebar-collapsed', String(next))
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
      <div style={{
        padding: '12px 10px',
        borderBottom: '1px solid #1F2937',
        display: 'flex',
        alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'space-between',
        gap: 6,
        flexShrink: 0,
      }}>
        {/* ロゴアイコン（常時表示） */}
        <div style={{
          width: 26, height: 26, borderRadius: 6, background: '#0D9488',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 12 12" fill="none">
            <path d="M1.5 9L6 2.5l2.5 4 1.5-2.5 1.5 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        {/* ロゴテキスト（展開時のみ） */}
        {!collapsed && (
          <span style={{ fontSize: 13, fontWeight: 700, color: '#F9FAFB', letterSpacing: '-.2px', flex: 1 }}>
            GrowthHub
          </span>
        )}
        {/* トグルボタン */}
        <button
          onClick={toggle}
          title={collapsed ? 'サイドバーを開く' : 'サイドバーを閉じる'}
          style={{
            width: 24, height: 24, borderRadius: 5,
            background: 'transparent', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#6B7280', flexShrink: 0,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          {collapsed
            ? <PanelLeftOpen size={14} />
            : <PanelLeftClose size={14} />
          }
        </button>
      </div>

      {/* ナビゲーション */}
      <nav style={{ padding: '8px 6px', flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>
        {NAV_ITEMS.map((item, i) => {
          if ('divider' in item) {
            return <div key={i} style={{ height: 1, background: '#1E293B', margin: '6px 0' }} />
          }
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <div key={item.href} style={{ position: 'relative' }} className="sidebar-nav-item-wrap">
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 9,
                  padding: collapsed ? '7px 0' : `7px ${item.sub ? 20 : 10}px`,
                  borderRadius: 6,
                  fontSize: item.sub ? 12 : 12.5,
                  fontWeight: isActive ? 500 : 400,
                  color: isActive ? '#2DD4BF' : item.accent ? '#0D9488' : '#94A3B8',
                  background: isActive ? 'rgba(13,148,136,.2)' : 'transparent',
                  textDecoration: 'none',
                  transition: 'all .12s',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                }}
                onMouseEnter={e => {
                  if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,.07)'
                  if (!isActive) e.currentTarget.style.color = '#CBD5E1'
                }}
                onMouseLeave={e => {
                  if (!isActive) e.currentTarget.style.background = 'transparent'
                  if (!isActive) e.currentTarget.style.color = item.accent ? '#0D9488' : '#94A3B8'
                }}
              >
                <Icon size={14} style={{ flexShrink: 0 }} />
                {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                {/* バッジ: 展開時のみ表示 */}
                {!collapsed && item.badge && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9.5, fontFamily: 'DM Mono', fontWeight: 500,
                    minWidth: 17, height: 17, padding: '0 4px', borderRadius: 8,
                    background: '#0D9488', color: '#fff',
                  }}>
                    {/* リード件数をここに入れる: badge count はpropsで渡すかuseLeadCountフックで取得 */}
                  </span>
                )}
              </Link>
            </div>
          )
        })}
      </nav>

      {/* FM接続ステータス（展開時のみ） */}
      {!collapsed && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #1F2937', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#10B981', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 10.5, color: '#374151' }}>FileMaker API 接続中</span>
          </div>
          <div style={{ fontSize: 9.5, color: '#4B5563', fontFamily: 'DM Mono' }}>最終同期: 5分前</div>
        </div>
      )}
    </aside>
  )
}
```

### グローバルCSS追加（`src/app/globals.css`）

```css
/* サイドバーナビ hover tooltip（折りたたみ時） */
.sidebar-nav-item-wrap [title]:hover::after {
  content: attr(title);
  position: absolute;
  left: 52px;
  top: 50%;
  transform: translateY(-50%);
  background: #1F2937;
  color: #F9FAFB;
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 5px;
  white-space: nowrap;
  z-index: 100;
  pointer-events: none;
  box-shadow: 0 2px 8px rgba(0,0,0,.3);
}
```

---

## 修正 2: 期間フィルタの共通コンポーネント化

**新規ファイル**: `src/components/ui/DateRangePicker.tsx`

このコンポーネントをアナリティクス・広告マネージャー・集計など統計系ページで共通利用する。

### 仕様

```
[今日] [昨日] [7日] [30日] [90日] [今月] [先月] [全期間] [カスタム ▼]
```

- セグメントボタン形式（`<button>` で実装、`select` 不可）
- 選択中のボタン: `background: #0D9488, color: #fff`
- 「カスタム」選択時: `<input type="date">` × 2（開始・終了）がインラインで展開
- 返り値: `{ from: Date | null, to: Date | null }`

```tsx
'use client'
import { useState } from 'react'
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, subMonths } from 'date-fns'

export type DateRange = { from: Date | null; to: Date | null }

type Preset = {
  label: string
  key: string
  getRange: () => DateRange
}

const PRESETS: Preset[] = [
  { label: '今日',   key: 'today',   getRange: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: '昨日',   key: 'yday',    getRange: () => ({ from: startOfDay(subDays(new Date(),1)), to: endOfDay(subDays(new Date(),1)) }) },
  { label: '7日',    key: '7d',      getRange: () => ({ from: subDays(new Date(),7), to: new Date() }) },
  { label: '30日',   key: '30d',     getRange: () => ({ from: subDays(new Date(),30), to: new Date() }) },
  { label: '90日',   key: '90d',     getRange: () => ({ from: subDays(new Date(),90), to: new Date() }) },
  { label: '今月',   key: 'thisM',   getRange: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: '先月',   key: 'lastM',   getRange: () => { const m=subMonths(new Date(),1); return { from: startOfMonth(m), to: endOfMonth(m) } } },
  { label: '全期間', key: 'all',     getRange: () => ({ from: null, to: null }) },
  { label: 'カスタム', key: 'custom', getRange: () => ({ from: null, to: null }) },
]

interface Props {
  value: DateRange
  onChange: (range: DateRange) => void
}

export function DateRangePicker({ value, onChange }: Props) {
  const [activeKey, setActiveKey] = useState('30d')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo]   = useState('')

  const handlePreset = (p: Preset) => {
    setActiveKey(p.key)
    if (p.key !== 'custom') {
      onChange(p.getRange())
    }
  }

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onChange({ from: new Date(customFrom), to: new Date(customTo) })
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <div style={{ display: 'flex', background: '#F1F5F9', borderRadius: 7, padding: 3, gap: 2 }}>
        {PRESETS.map(p => (
          <button
            key={p.key}
            onClick={() => handlePreset(p)}
            style={{
              padding: '4px 10px',
              borderRadius: 5,
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontFamily: 'DM Sans, sans-serif',
              background: activeKey === p.key ? '#fff' : 'transparent',
              color:      activeKey === p.key ? '#0D9488' : '#6B7280',
              fontWeight: activeKey === p.key ? 600 : 400,
              boxShadow:  activeKey === p.key ? '0 1px 3px rgba(0,0,0,.08)' : 'none',
              transition: 'all .12s',
              whiteSpace: 'nowrap',
            }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {/* カスタム日付入力（展開時） */}
      {activeKey === 'custom' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="date"
            value={customFrom}
            onChange={e => setCustomFrom(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, fontFamily: 'DM Mono' }}
          />
          <span style={{ color: '#9CA3AF', fontSize: 12 }}>〜</span>
          <input
            type="date"
            value={customTo}
            onChange={e => setCustomTo(e.target.value)}
            style={{ padding: '4px 8px', border: '1px solid #E5E7EB', borderRadius: 6, fontSize: 12, fontFamily: 'DM Mono' }}
          />
          <button
            onClick={handleCustomApply}
            disabled={!customFrom || !customTo}
            style={{
              padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontSize: 12, background: '#0D9488', color: '#fff', fontWeight: 500,
            }}
          >
            適用
          </button>
        </div>
      )}
    </div>
  )
}
```

### アナリティクス・広告マネージャーへの適用

`AnalyticsClient.tsx` の `dateRange` state を `DateRange` 型に変更し、`<DateRangePicker>` を使用する。
`AdManagerView`（広告マネージャー）の既存の `period` state も `<DateRangePicker>` で置き換える。

---

## 修正 3: 広告チェックボックス比較 + クリエイティブ画像表示

### 3.1 広告選択パネル（`_components/AdSelector.tsx`）

既存のドロップダウンを廃止し、カード式チェックボックスに変更する。

**UI仕様（スプレッドシートの各広告ブロック = 1枚のカード）**:

```
┌────────────────────────────────────┐
│ ☑  [クリエイティブ画像 60×60]     │
│    金額表示_ポップ_イラスト20250622 │
│    リード: 1,383  アポ率: 20.8%    │
└────────────────────────────────────┘
```

```tsx
'use client'
import { useState } from 'react'
import Image from 'next/image'
import type { AdSummaryRow } from '../_lib/types'

interface Props {
  ads: AdSummaryRow[]
  selected: string[]           // adName[]
  onChange: (selected: string[]) => void
}

export function AdSelector({ ads, selected, onChange }: Props) {
  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter(n => n !== name)
        : [...selected, name]
    )
  }

  const allChecked = selected.length === ads.length
  const toggleAll  = () => onChange(allChecked ? [] : ads.map(a => a.adName))

  return (
    <div>
      {/* 全選択トグル */}
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          style={{ accentColor: '#0D9488', width: 14, height: 14 }}
        />
        全広告を選択（{ads.length}件）
      </label>

      {/* 広告カード一覧（横スクロール） */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
        {ads.map(ad => {
          const checked = selected.includes(ad.adName)
          return (
            <label
              key={ad.adName}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: checked ? '2px solid #0D9488' : '1px solid #E5E7EB',
                background: checked ? 'rgba(13,148,136,.04)' : '#fff',
                cursor: 'pointer',
                minWidth: 160,
                maxWidth: 180,
                transition: 'all .12s',
                flexShrink: 0,
              }}
            >
              {/* チェックボックス */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(ad.adName)}
                  style={{ accentColor: '#0D9488', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 10.5, color: checked ? '#0D9488' : '#9CA3AF', fontWeight: 500 }}>
                  {checked ? '選択中' : '未選択'}
                </span>
              </div>

              {/* クリエイティブ画像 */}
              <div style={{
                width: '100%', height: 80, borderRadius: 5, overflow: 'hidden',
                background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {ad.creativeImageUrl ? (
                  <img
                    src={ad.creativeImageUrl}
                    alt={ad.adName}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  <span style={{ fontSize: 10, color: '#CBD5E1' }}>画像なし</span>
                )}
              </div>

              {/* 広告名 */}
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#111827',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {ad.adName}
              </div>

              {/* ミニ指標 */}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono', color: '#111827' }}>
                    {ad.leads.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#9CA3AF' }}>リード</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'DM Mono', color: '#0D9488' }}>
                    {ad.appoRate.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 9.5, color: '#9CA3AF' }}>アポ率</div>
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
```

### 3.2 クリエイティブ画像の取得

`AdSummaryRow` 型に `creativeImageUrl?: string` を追加。
画像URLの取得元: `leads` テーブルの `source_data->>'creative_image_url'` または `webhook_leads` テーブルの `payload->>'image_url'`。

`aggregations.ts` の `aggregateByAd` で以下を追加:

```typescript
// 同一 ad_name の中から最初に見つかった画像URLを代表画像とする
creativeImageUrl: leads
  .filter(l => l.ad_name === adName)
  .map(l => l.source_data?.creative_image_url || l.source_data?.image_url)
  .find(Boolean) ?? null
```

画像が存在しない場合は「画像なし」プレースホルダーを表示（エラーにしない）。

---

## 修正 4: グラフ ON/OFF 切り替え

### 4.1 メトリクス選択パネル（`_components/MetricSelector.tsx`）

各タブのチャートエリア上部に設置。選択したメトリクスのみグラフを表示する。

**スプレッドシートの全指標から選択可能にする**:

```typescript
export const ALL_METRICS = [
  // ── リスト集計 ──────────────────────
  { key: 'leads',          label: 'リスト数（リード数）', category: 'list', chartType: 'bar' },
  { key: 'appo',           label: 'アポOK数',           category: 'list', chartType: 'bar' },
  { key: 'chosei',         label: '調整中（リスク/商談前）', category: 'list', chartType: 'bar' },
  { key: 'saiyo',          label: '採用OK（商談着座）',  category: 'list', chartType: 'bar' },
  { key: 'saiyoNg',        label: '採用NG',              category: 'list', chartType: 'bar' },
  { key: 'juchu',          label: '受注',                category: 'list', chartType: 'bar' },
  { key: 'taishogai',      label: '対象外',              category: 'list', chartType: 'bar' },
  { key: 'kanryo',         label: '完了',                category: 'list', chartType: 'bar' },
  { key: 'mikanryo',       label: '未完了',              category: 'list', chartType: 'bar' },
  { key: 'miCall',         label: '未コール',            category: 'list', chartType: 'bar' },
  { key: 'rusu',           label: '留守',                category: 'list', chartType: 'bar' },
  { key: 'mikomiA',        label: '見込みA',             category: 'list', chartType: 'bar' },
  { key: 'mikomiB',        label: '見込みB',             category: 'list', chartType: 'bar' },
  { key: 'mikomiC',        label: '見込みC',             category: 'list', chartType: 'bar' },
  // ── 率指標 ──────────────────────────
  { key: 'appoRate',       label: '対リストアポ率',      category: 'rate', chartType: 'line' },
  { key: 'appoRateKanryo', label: '対完了アポ率',        category: 'rate', chartType: 'line' },
  { key: 'chakuzaRateList',label: '対リスト着座率',      category: 'rate', chartType: 'line' },
  { key: 'chakuzaRateAppo',label: '対アポ着座率',        category: 'rate', chartType: 'line' },
  { key: 'chakuzaRateKanryo', label: '対完了着座率',     category: 'rate', chartType: 'line' },
  { key: 'juchuRateShodan',label: '対商談OK受注率',      category: 'rate', chartType: 'line' },
  { key: 'juchuRateList',  label: '対リスト受注率',      category: 'rate', chartType: 'line' },
  { key: 'kanryoRate',     label: 'リスト完了率',        category: 'rate', chartType: 'line' },
  // ── 広告指標 ────────────────────────
  { key: 'adLeads',        label: 'リード（広告）',      category: 'ad',   chartType: 'bar' },
  { key: 'clicks',         label: 'クリック',            category: 'ad',   chartType: 'bar' },
  { key: 'reach',          label: 'リーチ',              category: 'ad',   chartType: 'bar' },
  { key: 'impressions',    label: 'インプレッション',    category: 'ad',   chartType: 'bar' },
  { key: 'cpa',            label: 'CPA',                 category: 'ad',   chartType: 'bar' },
  { key: 'ctr',            label: 'CTR',                 category: 'ad',   chartType: 'line' },
  { key: 'cpc',            label: 'CPC',                 category: 'ad',   chartType: 'bar' },
  { key: 'cpm',            label: 'CPM',                 category: 'ad',   chartType: 'bar' },
  { key: 'adSpend',        label: '広告費',              category: 'ad',   chartType: 'bar' },
  { key: 'cpaPerLead',     label: '1リスト獲得単価',     category: 'ad',   chartType: 'bar' },
  { key: 'cpaPerAppo',     label: '1アポ当たり単価',     category: 'ad',   chartType: 'bar' },
  { key: 'cpaPerSaiyo',    label: '1採用当たり単価',     category: 'ad',   chartType: 'bar' },
  { key: 'cpo',            label: '1受注あたり広告費(CPO)', category: 'ad', chartType: 'bar' },
  { key: 'totalRevenue',   label: '総受注額',            category: 'ad',   chartType: 'bar' },
  { key: 'roas',           label: 'ROAS',                category: 'ad',   chartType: 'line' },
] as const

export type MetricKey = typeof ALL_METRICS[number]['key']
```

### 4.2 MetricSelector コンポーネント

```tsx
'use client'
import { ALL_METRICS, type MetricKey } from '../_lib/metrics'

const CATEGORIES = [
  { key: 'list', label: 'リスト集計' },
  { key: 'rate', label: '率指標' },
  { key: 'ad',   label: '広告指標' },
]

interface Props {
  selected: MetricKey[]
  onChange: (keys: MetricKey[]) => void
}

export function MetricSelector({ selected, onChange }: Props) {
  const toggle = (key: MetricKey) => {
    onChange(
      selected.includes(key)
        ? selected.filter(k => k !== key)
        : [...selected, key]
    )
  }

  return (
    <div style={{ background: '#F8FAFC', border: '1px solid #E5E7EB', borderRadius: 8, padding: '12px 16px', marginBottom: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
        📊 グラフ表示指標を選択
        <span style={{ fontSize: 11, fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
          {selected.length}件選択中
        </span>
      </div>
      {CATEGORIES.map(cat => (
        <div key={cat.key} style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: '#6B7280', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.5px' }}>
            {cat.label}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ALL_METRICS.filter(m => m.category === cat.key).map(metric => {
              const on = selected.includes(metric.key)
              return (
                <button
                  key={metric.key}
                  onClick={() => toggle(metric.key)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 11.5,
                    background: on ? '#0D9488' : '#fff',
                    color:      on ? '#fff' : '#6B7280',
                    fontWeight: on ? 600 : 400,
                    border: on ? '1px solid #0D9488' : '1px solid #E5E7EB',
                    transition: 'all .1s',
                  }}
                >
                  {/* グラフタイプアイコン */}
                  <span style={{ fontSize: 9 }}>
                    {metric.chartType === 'line' ? '📈' : metric.chartType === 'bar' ? '📊' : '🥧'}
                  </span>
                  {metric.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
```

### 4.3 動的グラフ描画（`_components/DynamicChart.tsx`）

選択されたメトリクスを1つのチャートに重ねて描画。

```tsx
'use client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer
} from 'recharts'
import { ALL_METRICS, type MetricKey } from '../_lib/metrics'

// 指標ごとの色割り当て（固定パレット）
const METRIC_COLORS: Record<string, string> = {
  leads: '#0D9488', appo: '#10B981', kanryo: '#6366F1',
  mikanryo: '#F59E0B', appoRate: '#0EA5E9', kanryoRate: '#8B5CF6',
  adSpend: '#EF4444', roas: '#F97316', cpa: '#DC2626',
  clicks: '#64748B', reach: '#94A3B8', impressions: '#CBD5E1',
  totalRevenue: '#15803D', cpo: '#B91C1C',
  // ... 他は自動割り当て
}

const AUTO_PALETTE = ['#2DD4BF','#818CF8','#FB923C','#A78BFA','#34D399','#FCD34D']

interface Props {
  data: Record<string, any>[]  // x軸キーと各メトリクス値を持つ配列
  xKey: string
  selectedMetrics: MetricKey[]
}

export function DynamicChart({ data, xKey, selectedMetrics }: Props) {
  if (selectedMetrics.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
        上の「グラフ表示指標を選択」からメトリクスを選んでください
      </div>
    )
  }

  // 左軸（数値）/ 右軸（%）を分離
  const rateMetrics = ALL_METRICS.filter(m => m.category === 'rate').map(m => m.key)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <ComposedChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis yAxisId="left"  tick={{ fontSize: 10, fill: '#9CA3AF' }} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} tickFormatter={v => `${v}%`} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E5E7EB' }}
          formatter={(value: number, name: string) => {
            const m = ALL_METRICS.find(x => x.key === name)
            const isRate = rateMetrics.includes(name as MetricKey)
            return [isRate ? `${value.toFixed(1)}%` : value.toLocaleString(), m?.label ?? name]
          }}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} />
        {selectedMetrics.map((key, idx) => {
          const meta = ALL_METRICS.find(m => m.key === key)!
          const color = METRIC_COLORS[key] ?? AUTO_PALETTE[idx % AUTO_PALETTE.length]
          const isRate = rateMetrics.includes(key)
          const axis = isRate ? 'right' : 'left'

          if (meta.chartType === 'line') {
            return (
              <Line
                key={key} type="monotone" dataKey={key} name={key}
                stroke={color} strokeWidth={2} dot={false} yAxisId={axis}
              />
            )
          }
          return (
            <Bar
              key={key} dataKey={key} name={key}
              fill={color} fillOpacity={0.85} radius={[2,2,0,0]} yAxisId={axis}
            />
          )
        })}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
```

---

## 修正 5: スプレッドシート全指標の追加

### 5.1 `aggregations.ts` の全指標計算追加

`aggregateByAd` と `aggregateByMonth` に以下の全指標を追加する。

**スプレッドシートの全行を網羅した計算式**:

```typescript
// ━━ aggregateByAd の返り値に追加 ━━

// ステータス別カウント
chosei:          count(status === '調整中（リスク/商談前）'),
saiyo:           count(status === '採用OK（商談着座）'),
saiyoNg:         count(status === '採用NG'),
juchu:           count(status === '受注'),
taishogai:       count(status === '対象外'),
kanryo:          完了数（既存）,
mikanryo:        未完了数（既存）,
miCall:          count(status === '未コール'),
rusu:            count(status === '留守'),
mikomiA:         count(status === '見込みA'),
mikomiB:         count(status === '見込みB'),
mikomiC:         count(status === '見込みC'),

// 率指標（スプレッドシート row17〜row24 全部）
appoRate:            appo / leads * 100,                    // 対リストアポ率
appoRateKanryo:      appo / kanryo * 100,                   // 対完了アポ率
chakuzaRateList:     saiyo / leads * 100,                   // 対リスト着座率
chakuzaRateAppo:     saiyo / appo * 100,                    // 対アポ着座率
chakuzaRateKanryo:   saiyo / kanryo * 100,                  // 対完了着座率
juchuRateShodan:     juchu / saiyo * 100,                   // 対商談OK受注率
juchuRateList:       juchu / leads * 100,                   // 対リスト受注率
kanryoRate:          kanryo / leads * 100,                  // リスト完了率

// 広告指標（スプレッドシート row25〜row40）
// ※ 広告費・クリック・リーチ・インプは leads.source_data から取得
//　 または webhook_leads から集計（実装方針は下記参照）
clicks:              SUM(source_data.clicks),
reach:               SUM(source_data.reach),
impressions:         SUM(source_data.impressions),
adSpend:             SUM(source_data.spend),
cpa:                 adSpend / leads,                       // CPA
ctr:                 clicks / impressions * 100,             // CTR
cpc:                 adSpend / clicks,                      // CPC
cpm:                 adSpend / impressions * 1000,           // CPM
cpaPerLead:          adSpend / leads,                       // 1リスト獲得単価（=CPA）
cpaPerAppo:          adSpend / appo,                        // 1アポ当たり単価
cpaPerSaiyo:         adSpend / saiyo,                       // 1採用当たり単価
cpo:                 adSpend / juchu,                       // 1受注あたり広告費（CPO）
totalRevenue:        SUM(deals.deal_amount),                // 総受注額
roas:                totalRevenue / adSpend * 100,          // ROAS(%)
```

### 5.2 広告費データの取得方針

**現時点でadSpendがSupabaseにない場合の対応**:

```typescript
// leads テーブルの source_data(jsonb) から広告費を取得
// Meta Webhook でリード取得時に cost_per_lead を記録している場合:
const adSpend = leads
  .filter(l => l.source_data?.spend)
  .reduce((sum, l) => sum + (l.source_data.spend ?? 0), 0)

// source_data に広告費がない場合はnullとして扱い、
// UI上では「広告費未連携」バッジを表示し、CPO/ROASは「-」表示。
// 計算上のゼロ除算は全て Optional chaining で防ぐ:
const cpo = (adSpend > 0 && juchu > 0) ? adSpend / juchu : null
const roas = (adSpend > 0 && totalRevenue > 0) ? totalRevenue / adSpend * 100 : null
```

### 5.3 AdSummaryTable の全カラム追加

既存の AdSummaryTable に以下のカラムを追加（横スクロール対応済みなのでカラム追加のみ）:

**追加カラム一覧（スプレッドシート完全対応）**:

| グループ | カラム名 | 既存/追加 |
|---------|---------|---------|
| リスト集計 | リスト数 | 既存（leads） |
| リスト集計 | アポOK | 既存 |
| リスト集計 | 調整中 | **追加** |
| リスト集計 | 採用OK | **追加** |
| リスト集計 | 採用NG | **追加** |
| リスト集計 | 受注 | **追加** |
| リスト集計 | 対象外 | **追加** |
| リスト集計 | 完了 | 既存 |
| リスト集計 | 未コール | **追加** |
| リスト集計 | 留守 | **追加** |
| リスト集計 | 見込みA | **追加** |
| リスト集計 | 見込みB | **追加** |
| リスト集計 | 見込みC | **追加** |
| リスト集計 | 未完了 | 既存 |
| 率指標 | 対リストアポ率 | 既存 |
| 率指標 | 対完了アポ率 | **追加** |
| 率指標 | 対リスト着座率 | **追加** |
| 率指標 | 対アポ着座率 | **追加** |
| 率指標 | 対完了着座率 | **追加** |
| 率指標 | 対商談OK受注率 | **追加** |
| 率指標 | 対リスト受注率 | **追加** |
| 率指標 | リスト完了率 | 既存 |
| 広告指標 | リード（広告） | **追加** |
| 広告指標 | クリック | **追加** |
| 広告指標 | リーチ | **追加** |
| 広告指標 | インプ | **追加** |
| 広告指標 | CPA | **追加** |
| 広告指標 | CTR | **追加** |
| 広告指標 | CPC | **追加** |
| 広告指標 | CPM | **追加** |
| 広告指標 | 広告費 | **追加** |
| 広告指標 | 1リスト獲得単価 | **追加** |
| 広告指標 | 1アポ当たり単価 | **追加** |
| 広告指標 | 1採用当たり単価 | **追加** |
| 広告指標 | 1受注あたり広告費(CPO) | **追加** |
| 広告指標 | 総受注額 | 既存 |
| 広告指標 | ROAS | **追加** |

**テーブルのカラムグループ表示**: `<colgroup>` で「リスト集計」「率指標」「広告指標」の3グループに区切り線を入れる。

**固定列**: 「広告名」列を `position: sticky; left: 0` で左端に固定。

---

## 修正 6: AnalyticsClient.tsx の統合

修正1〜5を統合した新しい `AnalyticsClient.tsx`:

```tsx
'use client'
import { useState, useMemo } from 'react'
import { DateRangePicker, type DateRange } from '@/components/ui/DateRangePicker'
import { AdSelector } from './AdSelector'
import { MetricSelector } from './MetricSelector'
import { DynamicChart } from './DynamicChart'
import { AdSummaryTable } from './AdSummaryTable'
import { MonthlyTrendChart } from './MonthlyTrendChart'
import { CallEfficiencyPanel } from './CallEfficiencyPanel'
import { FunnelMetrics } from './FunnelMetrics'
import { KpiCardRow } from './KpiCardRow'
import { aggregateByAd, aggregateByMonth, filterByDateRange } from '../_lib/aggregations'
import type { MetricKey } from '../_lib/metrics'
import type { Lead, Deal } from '../_lib/types'

// デフォルト選択指標
const DEFAULT_METRICS: MetricKey[] = ['leads', 'appo', 'kanryo', 'appoRate', 'kanryoRate']

interface Props {
  rawLeads: Lead[]
  rawDeals: Deal[]
}

const TABS = [
  { key: 'summary',    label: '広告別サマリー' },
  { key: 'monthly',    label: '月次推移' },
  { key: 'efficiency', label: '架電効率' },
  { key: 'funnel',     label: 'ファネル分析' },
] as const

export function AnalyticsClient({ rawLeads, rawDeals }: Props) {
  const [dateRange, setDateRange]     = useState<DateRange>({ from: null, to: null })
  const [selectedAds, setSelectedAds] = useState<string[]>([])  // [] = 全選択
  const [activeTab, setActiveTab]     = useState<'summary'|'monthly'|'efficiency'|'funnel'>('summary')
  const [selectedMetrics, setSelectedMetrics] = useState<MetricKey[]>(DEFAULT_METRICS)

  // フィルタリング
  const filteredLeads = useMemo(() => {
    let leads = rawLeads
    if (dateRange.from) leads = leads.filter(l => new Date(l.inquiry_at) >= dateRange.from!)
    if (dateRange.to)   leads = leads.filter(l => new Date(l.inquiry_at) <= dateRange.to!)
    if (selectedAds.length > 0) leads = leads.filter(l => selectedAds.includes(l.ad_name ?? ''))
    return leads
  }, [rawLeads, dateRange, selectedAds])

  // 集計
  const adStats     = useMemo(() => aggregateByAd(filteredLeads, rawDeals), [filteredLeads, rawDeals])
  const monthlyData = useMemo(() => aggregateByMonth(filteredLeads), [filteredLeads])

  // 初回: 全広告を選択
  const allAdNames = [...new Set(rawLeads.map(l => l.ad_name).filter(Boolean))] as string[]
  const effectiveSelectedAds = selectedAds.length === 0 ? allAdNames : selectedAds

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: '#F5F7FA' }}>
      {/* ── ページヘッダー ── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E5E7EB', flexShrink: 0 }}>
        <div style={{ padding: '16px 24px 12px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 2 }}>アナリティクス</h1>
            <p style={{ fontSize: 11.5, color: '#9CA3AF' }}>広告 → リード → 受注 パフォーマンス分析</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {/* 共通期間フィルタ */}
            <DateRangePicker value={dateRange} onChange={setDateRange} />
            {/* CSVエクスポート */}
            <button
              onClick={() => exportCsv(adStats)}
              style={{
                padding: '5px 12px', borderRadius: 6, border: '1px solid #E5E7EB',
                background: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              ↓ CSV
            </button>
          </div>
        </div>

        {/* KPIカード */}
        <KpiCardRow stats={adStats} />

        {/* タブバー */}
        <div style={{ display: 'flex', borderTop: '1px solid #E5E7EB', padding: '0 24px' }}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              style={{
                padding: '10px 16px', fontSize: 12.5, fontWeight: 500, border: 'none',
                background: 'none', cursor: 'pointer',
                color: activeTab === t.key ? '#0D9488' : '#9CA3AF',
                borderBottom: activeTab === t.key ? '2px solid #0D9488' : '2px solid transparent',
                transition: 'all .12s', whiteSpace: 'nowrap',
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── コンテンツエリア ── */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 24px' }}>
        {/* 広告チェックボックス選択パネル（全タブ共通） */}
        <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
            広告クリエイティブ選択（複数選択で比較）
          </div>
          <AdSelector
            ads={adStats}
            selected={selectedAds}
            onChange={setSelectedAds}
          />
        </div>

        {/* グラフ指標セレクター（月次推移・ファネルタブ以外） */}
        {(activeTab === 'summary' || activeTab === 'monthly') && (
          <MetricSelector
            selected={selectedMetrics}
            onChange={setSelectedMetrics}
          />
        )}

        {/* 動的チャート（選択指標） */}
        {(activeTab === 'summary' || activeTab === 'monthly') && (
          <div style={{ background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10, padding: '16px 20px', marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
              {activeTab === 'summary' ? '広告別指標比較' : '月次推移'}
              <span style={{ fontSize: 11, fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
                {selectedMetrics.length}指標表示中
              </span>
            </div>
            <DynamicChart
              data={activeTab === 'summary'
                ? adStats.map(a => ({ x: a.adName.slice(0, 10) + '…', ...a }))
                : monthlyData.map(m => ({ x: m.month, ...m }))
              }
              xKey="x"
              selectedMetrics={selectedMetrics}
            />
          </div>
        )}

        {/* タブ別コンテンツ */}
        {activeTab === 'summary'    && <AdSummaryTable data={adStats} />}
        {activeTab === 'monthly'    && <MonthlyTrendChart data={monthlyData} selectedMetrics={selectedMetrics} />}
        {activeTab === 'efficiency' && <CallEfficiencyPanel />}
        {activeTab === 'funnel'     && <FunnelMetrics data={adStats} />}
      </div>
    </div>
  )
}

// CSVエクスポート（BOM付きUTF-8）
function exportCsv(rows: any[]) {
  const headers = [
    '広告名','リスト数','アポOK','調整中','採用OK','採用NG','受注','対象外','完了','未コール','留守',
    '見込みA','見込みB','見込みC','未完了',
    '対リストアポ率','対完了アポ率','対リスト着座率','対アポ着座率','対完了着座率',
    '対商談OK受注率','対リスト受注率','リスト完了率',
    'クリック','リーチ','インプ','CPA','CTR','CPC','CPM','広告費',
    '1リスト獲得単価','1アポ当たり単価','1採用当たり単価','1受注あたり広告費','総受注額','ROAS'
  ]
  const csv = [
    headers,
    ...rows.map(r => [
      r.adName, r.leads, r.appo, r.chosei, r.saiyo, r.saiyoNg, r.juchu, r.taishogai, r.kanryo,
      r.miCall, r.rusu, r.mikomiA, r.mikomiB, r.mikomiC, r.mikanryo,
      r.appoRate?.toFixed(1), r.appoRateKanryo?.toFixed(1), r.chakuzaRateList?.toFixed(1),
      r.chakuzaRateAppo?.toFixed(1), r.chakuzaRateKanryo?.toFixed(1),
      r.juchuRateShodan?.toFixed(1), r.juchuRateList?.toFixed(1), r.kanryoRate?.toFixed(1),
      r.clicks, r.reach, r.impressions, r.cpa?.toFixed(0), r.ctr?.toFixed(2),
      r.cpc?.toFixed(0), r.cpm?.toFixed(0), r.adSpend,
      r.cpaPerLead?.toFixed(0), r.cpaPerAppo?.toFixed(0), r.cpaPerSaiyo?.toFixed(0),
      r.cpo?.toFixed(0), r.totalRevenue, r.roas?.toFixed(1)
    ])
  ].map(row => row.join(',')).join('\n')
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `analytics_${new Date().toISOString().slice(0,10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
```

---

## 修正 7: 広告マネージャーへの DateRangePicker 適用

**ファイル**: `src/app/(dashboard)/ads/page.tsx` またはその Client Component

既存の `period` state（`'3m' | '6m' | 'all'`）を `DateRange` 型に変更し、ヘッダーの期間選択を `<DateRangePicker>` に置き換える。

```tsx
// Before（既存実装）
const [period, setPeriod] = useState<'3m' | '6m' | 'all'>('6m')

// After（DateRangePickerに変更）
import { DateRangePicker, type DateRange } from '@/components/ui/DateRangePicker'
const [dateRange, setDateRange] = useState<DateRange>({ from: null, to: null })
// ...
<DateRangePicker value={dateRange} onChange={setDateRange} />
```

---

## 実装順序

1. `src/components/ui/DateRangePicker.tsx` — 共通コンポーネント（先に作ると他が楽）
2. `src/components/layout/sidebar.tsx` — 折りたたみ実装
3. `src/app/(dashboard)/analytics/_lib/metrics.ts` — 全指標定義
4. `src/app/(dashboard)/analytics/_lib/aggregations.ts` — 全指標計算追加
5. `src/app/(dashboard)/analytics/_lib/types.ts` — AdSummaryRow 型拡張
6. `src/app/(dashboard)/analytics/_components/AdSelector.tsx` — チェックボックス選択
7. `src/app/(dashboard)/analytics/_components/MetricSelector.tsx` — 指標ON/OFF
8. `src/app/(dashboard)/analytics/_components/DynamicChart.tsx` — 動的チャート
9. `src/app/(dashboard)/analytics/_components/AdSummaryTable.tsx` — 全カラム追加
10. `src/app/(dashboard)/analytics/_components/AnalyticsClient.tsx` — 統合
11. `src/app/(dashboard)/ads/**` — DateRangePicker 適用

---

## 完成確認チェックリスト

- [ ] サイドバーが `←` ボタンで折りたたまれ、アイコンのみになる
- [ ] 折りたたみ状態でページリロードしても状態が維持される（localStorage）
- [ ] アイコンにホバーでツールチップが表示される
- [ ] `DateRangePicker` でアナリティクス・広告マネージャー両方の期間フィルタが動作する
- [ ] 「カスタム」選択で日付入力フィールドが表示され、適用ボタンで絞り込まれる
- [ ] 広告カードがチェックボックスで複数選択可能
- [ ] チェックボックス選択の状態がグラフとテーブル両方に反映される
- [ ] クリエイティブ画像がある広告はカードにサムネイルが表示される
- [ ] グラフ指標のトグルボタン（チップ形式）でグラフが動的に更新される
- [ ] 複数メトリクス選択時、棒グラフと折れ線が混在して表示される（ComposedChart）
- [ ] スプレッドシートの全指標（35項目）がテーブルカラムに存在する
- [ ] テーブルで「広告名」列が横スクロール時に左固定される
- [ ] 広告費データが未連携の列は「-」表示（ゼロ除算エラーなし）
- [ ] CSVエクスポートで全指標が出力される（BOM付きUTF-8で文字化けなし）
- [ ] ビルド `npm run build` がエラーなし
- [ ] Vercel デプロイ後もエラーなし
