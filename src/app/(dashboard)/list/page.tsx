'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell, SortAsc, SortDesc, X, Save, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ListRecord = {
  id: string
  tenant_id: string
  customer_id: string | null
  ad_name: string | null
  company_name: string | null
  title: string | null
  representative_name: string | null
  prefecture: string | null
  phone_numbers: string[] | null
  last_call_result: string | null
  last_call_count: number | null
  status: string | null
  custom_data: Record<string, unknown> | null
  created_at: string
  inquiry_count: number | null
  last_inquiry_at: string | null
  last_inquiry_ad_name: string | null
}

const LAST_CALL_RESULT_OPTIONS = ['アポOK', 'NG', '留守', '対象外', '再コール', '思案中', 'ポータルサイト']
const RESULT_COLORS: Record<string, { bg: string; color: string }> = {
  'アポOK':    { bg: 'var(--color-success-bg)', color: 'var(--color-success)' },
  'NG':        { bg: 'var(--color-danger-bg)',  color: 'var(--color-danger)' },
  '留守':      { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)' },
  '対象外':    { bg: 'var(--color-gray-100)',   color: 'var(--color-gray-500)' },
  '再コール':  { bg: '#EFF6FF',                color: '#1D4ED8' },
  '思案中':    { bg: '#FFF7ED',                color: '#C2410C' },
}

type SortKey = { field: string; dir: 'asc' | 'desc' }

interface SearchCondition {
  id: string
  field: string
  op: string
  value: string
}

const SEARCH_FIELDS = [
  { label: '会社名',      key: 'company_name' },
  { label: '代表名',      key: 'representative_name' },
  { label: '広告名',      key: 'ad_name' },
  { label: '都道府県',    key: 'prefecture' },
  { label: '最終架電結果', key: 'last_call_result' },
  { label: 'ステータス',  key: 'status' },
]

const SEARCH_OPS = [
  { label: '含む（*）',     value: 'ilike' },
  { label: '完全一致（=）', value: 'eq' },
  { label: '除外（!）',     value: 'neq' },
  { label: '以上（>=）',    value: 'gte' },
  { label: '以下（<=）',    value: 'lte' },
]

const thBase = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap select-none cursor-pointer'
const tdBase = 'px-3 py-2 text-[12px] whitespace-nowrap align-middle'

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span style={{ color: 'var(--color-gray-300)' }}>—</span>
  const c = RESULT_COLORS[result]
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
      style={c ?? { background: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }}
    >
      {result}
    </span>
  )
}

function SortIcon({ field, sorts }: { field: string; sorts: SortKey[] }) {
  const s = sorts.find((x) => x.field === field)
  if (!s) return null
  const idx = sorts.indexOf(s) + 1
  return (
    <span className="ml-1 inline-flex items-center gap-0.5" style={{ color: 'var(--color-blue)' }}>
      {s.dir === 'asc' ? <SortAsc size={11} /> : <SortDesc size={11} />}
      {sorts.length > 1 && <span className="text-[9px]">{idx}</span>}
    </span>
  )
}

export default function ListPage() {
  const router = useRouter()
  const [records, setRecords] = useState<ListRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)

  // Normal filter
  const [q, setQ] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Sort
  const [sorts, setSorts] = useState<SortKey[]>([{ field: 'created_at', dir: 'desc' }])

  // Search mode
  const [searchMode, setSearchMode] = useState(false)
  const [conditions, setConditions] = useState<SearchCondition[]>([
    { id: crypto.randomUUID(), field: 'company_name', op: 'ilike', value: '' },
  ])
  const [savedSearches, setSavedSearches] = useState<{ name: string; conditions: SearchCondition[] }[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('crm_saved_searches') ?? '[]')
    } catch { return [] }
  })

  const buildUrl = useCallback((p: number, overrideConditions?: SearchCondition[]) => {
    const params = new URLSearchParams({ page: String(p) })
    if (q) params.set('q', q)
    if (resultFilter) params.set('last_call_result', resultFilter)
    if (statusFilter) params.set('status', statusFilter)

    // Encode search conditions
    const active = (overrideConditions ?? []).filter((c) => c.value.trim())
    if (active.length > 0) params.set('search', JSON.stringify(active))

    // Sort
    params.set('sort', JSON.stringify(sorts))
    return `/api/list-records?${params}`
  }, [q, resultFilter, statusFilter, sorts])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(buildUrl(1), { cache: 'no-store' })
        const json = await res.json() as { records: ListRecord[]; hasMore: boolean; total: number }
        if (!cancelled) {
          setRecords(json.records ?? [])
          setHasMore(json.hasMore ?? false)
          setTotal(json.total ?? 0)
          setPage(1)
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [buildUrl])

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('webhook_leads')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count }) => setPendingCount(count ?? 0))
  }, [])

  async function loadMore() {
    const nextPage = page + 1
    const res = await fetch(buildUrl(nextPage), { cache: 'no-store' })
    const json = await res.json() as { records: ListRecord[]; hasMore: boolean }
    setRecords((prev) => [...prev, ...(json.records ?? [])])
    setHasMore(json.hasMore ?? false)
    setPage(nextPage)
  }

  function toggleSort(field: string, shift: boolean) {
    setSorts((prev) => {
      const existing = prev.find((s) => s.field === field)
      if (existing) {
        if (shift) {
          // Toggle direction or remove
          if (existing.dir === 'asc') return prev.map((s) => s.field === field ? { ...s, dir: 'desc' as const } : s)
          return prev.filter((s) => s.field !== field)
        }
        return [{ field, dir: existing.dir === 'asc' ? 'desc' : 'asc' }]
      }
      if (shift) return [...prev, { field, dir: 'asc' }]
      return [{ field, dir: 'asc' }]
    })
  }

  function addCondition() {
    setConditions((prev) => [
      ...prev,
      { id: crypto.randomUUID(), field: 'company_name', op: 'ilike', value: '' },
    ])
  }

  function removeCondition(id: string) {
    setConditions((prev) => prev.filter((c) => c.id !== id))
  }

  function updateCondition(id: string, patch: Partial<SearchCondition>) {
    setConditions((prev) => prev.map((c) => c.id === id ? { ...c, ...patch } : c))
  }

  async function runSearch() {
    setSearchMode(false)
    setLoading(true)
    try {
      const res = await fetch(buildUrl(1, conditions), { cache: 'no-store' })
      const json = await res.json() as { records: ListRecord[]; hasMore: boolean; total: number }
      setRecords(json.records ?? [])
      setHasMore(json.hasMore ?? false)
      setTotal(json.total ?? 0)
      setPage(1)
    } finally {
      setLoading(false)
    }
  }

  function saveSearch() {
    const name = window.prompt('検索条件名を入力してください')
    if (!name) return
    const next = [...savedSearches, { name, conditions }]
    setSavedSearches(next)
    localStorage.setItem('crm_saved_searches', JSON.stringify(next))
  }

  function loadSaved(idx: number) {
    setConditions(savedSearches[idx].conditions.map((c) => ({ ...c, id: crypto.randomUUID() })))
  }

  function formatPhone(phones: string[] | null): string {
    if (!phones || phones.length === 0) return '—'
    return phones[0] ?? '—'
  }

  const thClick = (field: string) => (e: React.MouseEvent) => toggleSort(field, e.shiftKey)

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[20px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
            リスト一覧
          </h1>
          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: 'var(--color-gray-400)' }}>
            {total.toLocaleString()} 件
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <button
              type="button"
              onClick={() => router.push('/leads')}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-medium"
              style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
            >
              <Bell size={13} />
              新規リード受信 {pendingCount} 件
            </button>
          )}
          <button
            type="button"
            onClick={() => setSearchMode((p) => !p)}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium border transition-colors"
            style={{
              borderColor: searchMode ? '#0D9488' : 'var(--color-gray-200)',
              background: searchMode ? '#f0fdfa' : 'var(--color-white)',
              color: searchMode ? '#0D9488' : 'var(--color-gray-700)',
            }}
          >
            {searchMode ? '検索モード ✓' : '検索モード'}
          </button>
        </div>
      </div>

      {/* Search mode panel */}
      {searchMode && (
        <div
          className="mb-4 rounded-xl border p-4"
          style={{ borderColor: '#0D9488', background: '#f0fdfa' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[13px] font-semibold" style={{ color: '#0D9488' }}>
              検索条件
            </span>
            <div className="flex items-center gap-2">
              {savedSearches.length > 0 && (
                <div className="relative">
                  <select
                    onChange={(e) => { if (e.target.value !== '') loadSaved(Number(e.target.value)) }}
                    className="rounded border px-2 py-1 text-[11px]"
                    style={{ borderColor: 'var(--color-gray-200)' }}
                    defaultValue=""
                  >
                    <option value="">保存済み検索</option>
                    {savedSearches.map((s, i) => (
                      <option key={i} value={i}>{s.name}</option>
                    ))}
                  </select>
                </div>
              )}
              <button
                onClick={saveSearch}
                className="flex items-center gap-1 text-[11px] px-2 py-1 rounded border"
                style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-gray-600)' }}
              >
                <Save size={11} /> 保存
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {conditions.map((cond) => (
              <div key={cond.id} className="flex items-center gap-2">
                <select
                  value={cond.field}
                  onChange={(e) => updateCondition(cond.id, { field: e.target.value })}
                  className="rounded border px-2 py-1.5 text-[12px]"
                  style={{ borderColor: 'var(--color-gray-200)', minWidth: 120 }}
                >
                  {SEARCH_FIELDS.map((f) => (
                    <option key={f.key} value={f.key}>{f.label}</option>
                  ))}
                </select>
                <select
                  value={cond.op}
                  onChange={(e) => updateCondition(cond.id, { op: e.target.value })}
                  className="rounded border px-2 py-1.5 text-[12px]"
                  style={{ borderColor: 'var(--color-gray-200)', minWidth: 140 }}
                >
                  {SEARCH_OPS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="検索値"
                  value={cond.value}
                  onChange={(e) => updateCondition(cond.id, { value: e.target.value })}
                  onKeyDown={(e) => { if (e.key === 'Enter') runSearch() }}
                  className="rounded border px-2 py-1.5 text-[12px] flex-1"
                  style={{ borderColor: 'var(--color-gray-200)' }}
                />
                {conditions.length > 1 && (
                  <button onClick={() => removeCondition(cond.id)}>
                    <X size={14} style={{ color: 'var(--color-gray-400)' }} />
                  </button>
                )}
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={addCondition}
              className="text-[12px] px-3 py-1.5 rounded border"
              style={{ borderColor: '#0D9488', color: '#0D9488' }}
            >
              ＋ 新規条件（OR）
            </button>
            <button
              onClick={runSearch}
              className="text-[12px] px-4 py-1.5 rounded font-semibold"
              style={{ background: '#0D9488', color: '#fff' }}
            >
              検索実行
            </button>
            <button
              onClick={() => { setConditions([{ id: crypto.randomUUID(), field: 'company_name', op: 'ilike', value: '' }]); setSearchMode(false) }}
              className="text-[12px] px-3 py-1.5 rounded border"
              style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-gray-600)' }}
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Normal filter bar */}
      {!searchMode && (
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-gray-400)' }} />
            <input
              type="text"
              placeholder="会社名・代表名で検索"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="rounded-lg border pl-8 pr-3 py-1.5 text-[13px]"
              style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)', width: 220 }}
            />
          </div>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
          >
            <option value="">最終架電結果（全て）</option>
            {LAST_CALL_RESULT_OPTIONS.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border px-3 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
          >
            <option value="">ステータス（全て）</option>
            <option value="過去データ（未分類）">過去データ（未分類）</option>
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
          {sorts.length > 0 && (
            <span className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>
              Shiftクリックで複合ソート
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-xl border overflow-hidden overflow-x-auto"
        style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}
      >
        <table className="text-[12px] border-collapse w-full" style={{ minWidth: 1280 }}>
          <thead className="sticky top-0 z-10" style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
            <tr>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 96 }} onClick={thClick('created_at')}>
                問い合わせ日<SortIcon field="created_at" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 150 }} onClick={thClick('ad_name')}>
                広告名<SortIcon field="ad_name" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 140 }} onClick={thClick('company_name')}>
                会社名<SortIcon field="company_name" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }} onClick={thClick('representative_name')}>
                代表名<SortIcon field="representative_name" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 80 }}>役職</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 80 }} onClick={thClick('prefecture')}>
                県名<SortIcon field="prefecture" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 120 }}>電話番号</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }} onClick={thClick('last_call_result')}>
                最終架電結果<SortIcon field="last_call_result" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 60, textAlign: 'right' }} onClick={thClick('last_call_count')}>
                コール<SortIcon field="last_call_count" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 60, textAlign: 'right' }} onClick={thClick('inquiry_count')}>
                問い合わせ<SortIcon field="inquiry_count" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 96 }} onClick={thClick('last_inquiry_at')}>
                最終問い合わせ<SortIcon field="last_inquiry_at" sorts={sorts} />
              </th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 120 }} onClick={thClick('status')}>
                ステータス<SortIcon field="status" sorts={sorts} />
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--color-gray-400)' }}>
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  データがありません
                </td>
              </tr>
            )}
            {!loading && records.map((rec, idx) => (
              <tr
                key={rec.id}
                onClick={() => router.push(`/list/${rec.id}`)}
                className="cursor-pointer"
                style={{
                  borderBottom: '1px solid var(--color-gray-200)',
                  background: idx % 2 === 1 ? '#f9fafb' : '#ffffff',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = '#f0fdf4')}
                onMouseLeave={(e) => (e.currentTarget.style.background = idx % 2 === 1 ? '#f9fafb' : '#ffffff')}
              >
                <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-700)' }}>
                  {rec.created_at?.slice(0, 10) ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-700)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rec.ad_name ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-900)', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {rec.company_name ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-700)' }}>
                  {rec.representative_name ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-600)' }}>
                  {rec.title ?? (rec.custom_data?.rep_title as string) ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-600)' }}>
                  {rec.prefecture ?? '—'}
                </td>
                <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                  {formatPhone(rec.phone_numbers)}
                </td>
                <td className={tdBase}>
                  <ResultBadge result={rec.last_call_result} />
                </td>
                <td className={`${tdBase} tabular-nums text-right`} style={{ color: 'var(--color-gray-600)' }}>
                  {rec.last_call_count ?? '—'}
                </td>
                <td className={`${tdBase} tabular-nums text-right`} style={{ color: rec.inquiry_count ? 'var(--color-blue)' : 'var(--color-gray-400)' }}>
                  {rec.inquiry_count ?? 0}
                </td>
                <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                  {rec.last_inquiry_at ? rec.last_inquiry_at.slice(0, 10) : '—'}
                </td>
                <td className={tdBase}>
                  {rec.status ? (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[11px]"
                      style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }}
                    >
                      {rec.status}
                    </span>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="rounded-lg px-6 py-2 text-[13px] font-medium border"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-700)' }}
          >
            さらに読み込む
          </button>
        </div>
      )}
    </div>
  )
}
