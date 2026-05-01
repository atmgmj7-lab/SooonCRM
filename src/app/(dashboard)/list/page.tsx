'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

type ListRecord = {
  id: string
  tenant_id: string
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
}

const LAST_CALL_RESULT_OPTIONS = ['', 'アポOK', 'NG', '留守', '対象外', '再コール', '思案中', 'ポータルサイト']

interface Filters {
  q: string
  last_call_result: string
  status: string
}

const thBase = 'px-3 py-2.5 text-left text-[12px] font-medium whitespace-nowrap'
const tdBase = 'px-3 py-2 text-[12px] whitespace-nowrap align-middle'

export default function ListPage() {
  const router = useRouter()
  const [records, setRecords] = useState<ListRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [total, setTotal] = useState(0)
  const [pendingCount, setPendingCount] = useState(0)
  const [filters, setFilters] = useState<Filters>({ q: '', last_call_result: '', status: '' })

  const buildUrl = useCallback((f: Filters, p: number) => {
    const params = new URLSearchParams({ page: String(p) })
    if (f.q) params.set('q', f.q)
    if (f.last_call_result) params.set('last_call_result', f.last_call_result)
    if (f.status) params.set('status', f.status)
    return `/api/list-records?${params}`
  }, [])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const res = await fetch(buildUrl(filters, 1), { cache: 'no-store' })
        const json = await res.json() as { records: ListRecord[]; hasMore: boolean; total: number }
        console.log('[list-page] API status:', res.status, 'keys:', Object.keys(json), 'first record:', JSON.stringify(json.records?.[0]).slice(0, 300))
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
  }, [filters, buildUrl])

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
    const res = await fetch(buildUrl(filters, nextPage), { cache: 'no-store' })
    const json = await res.json() as { records: ListRecord[]; hasMore: boolean }
    setRecords((prev) => [...prev, ...(json.records ?? [])])
    setHasMore(json.hasMore ?? false)
    setPage(nextPage)
  }

  function updateFilter<K extends keyof Filters>(key: K, value: Filters[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }))
  }

  function formatPhone(phones: string[] | null): string {
    if (!phones || phones.length === 0) return '—'
    const first = phones[0]
    return typeof first === 'string' ? first : '—'
  }

  function formatDate(dt: string): string {
    return dt ? dt.slice(0, 10) : '—'
  }

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
            リスト一覧
          </h1>
          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: 'var(--color-gray-400)' }}>
            {total.toLocaleString()} 件
          </p>
        </div>
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
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-gray-400)' }} />
          <input
            type="text"
            placeholder="会社名・代表名で検索"
            value={filters.q}
            onChange={(e) => updateFilter('q', e.target.value)}
            className="rounded-lg border pl-8 pr-3 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)', width: 220 }}
          />
        </div>
        <select
          value={filters.last_call_result}
          onChange={(e) => updateFilter('last_call_result', e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-[13px]"
          style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
        >
          <option value="">最終架電結果（全て）</option>
          {LAST_CALL_RESULT_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
        <select
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-[13px]"
          style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
        >
          <option value="">ステータス（全て）</option>
          <option value="過去データ（未分類）">過去データ（未分類）</option>
          <option value="active">active</option>
          <option value="inactive">inactive</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
        <table className="text-[12px] border-collapse w-full" style={{ minWidth: 1000 }}>
          <thead>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 96 }}>問い合わせ日</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 160 }}>広告名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 140 }}>会社名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }}>代表名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 80 }}>役職</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 80 }}>県名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 120 }}>電話番号</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }}>最終架電結果</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 60 }}>コール数</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 80 }}>完了進捗</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 120 }}>ステータス</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={11} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--color-gray-400)' }}>
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && records.length === 0 && (
              <tr>
                <td colSpan={11} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  データがありません
                </td>
              </tr>
            )}
            {!loading && records.map((rec) => (
              <tr
                key={rec.id}
                onClick={() => router.push(`/list/${rec.id}`)}
                className="cursor-pointer"
                style={{ borderBottom: '1px solid var(--color-gray-200)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-gray-50)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-700)' }}>
                  {formatDate(rec.created_at)}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-700)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                  {rec.last_call_result ? (
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{
                        background: rec.last_call_result === 'アポOK' ? 'var(--color-success-bg)' : 'var(--color-gray-100)',
                        color: rec.last_call_result === 'アポOK' ? 'var(--color-success)' : 'var(--color-gray-600)',
                      }}
                    >
                      {rec.last_call_result}
                    </span>
                  ) : '—'}
                </td>
                <td className={`${tdBase} tabular-nums text-right`} style={{ color: 'var(--color-gray-600)' }}>
                  {rec.last_call_count ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-600)' }}>
                  {(rec.custom_data?.completion_progress as string) ?? '—'}
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
