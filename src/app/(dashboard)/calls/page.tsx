'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Link2 } from 'lucide-react'

type ListRecord = {
  company_name: string | null
  representative_name: string | null
  phone_numbers: string[] | null
}

type Call = {
  id: string
  call_date: string | null
  call_start_time: string | null
  call_duration_minutes: number | null
  call_result: string | null
  agent_name: string | null
  call_category: string | null
  rep_level: string | null
  appo_detail: string | null
  list_record_id: string | null
  list_records: ListRecord | null
}

const RESULT_OPTIONS = ['アポOK', 'NG', '留守', '対象外', '再コール', '思案中', '現アナ', '重複']

const COL_WIDTHS = {
  list_link:     60,
  call_date:     88,
  call_time:     72,
  company_name: 140,
  rep_name:      96,
  phone:        112,
  call_result:   80,
  duration:      68,
  agent_name:    96,
  rep_level:     60,
  category:      80,
  appo_detail:  200,
}

const TOTAL_WIDTH = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0)

function Th({ label, w, center }: { label: string; w: number; center?: boolean }) {
  return (
    <th
      className={`px-2 py-2.5 text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis${center ? ' text-center' : ' text-left'}`}
      style={{ color: 'var(--color-gray-600)', width: w, minWidth: w, maxWidth: w }}
    >
      {label}
    </th>
  )
}

function Td({ value, w, center }: { value: React.ReactNode; w: number; center?: boolean }) {
  const text = typeof value === 'string' ? value : undefined
  return (
    <td
      title={text}
      className={`px-2 py-1.5 text-[11px] overflow-hidden whitespace-nowrap text-ellipsis align-middle${center ? ' text-center' : ''}`}
      style={{ width: w, minWidth: w, maxWidth: w, color: 'var(--color-gray-700)' }}
    >
      {value ?? '—'}
    </td>
  )
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span style={{ color: 'var(--color-gray-300)' }}>—</span>
  const isAppo = result === 'アポOK'
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{
        background: isAppo ? 'var(--color-success-bg)' : 'var(--color-gray-100)',
        color: isAppo ? 'var(--color-success)' : 'var(--color-gray-600)',
      }}
    >
      {result}
    </span>
  )
}

function ListLinkBadge({ listRecordId, onNavigate }: { listRecordId: string | null; onNavigate: () => void }) {
  if (!listRecordId) return <span style={{ color: 'var(--color-gray-200)' }}>—</span>
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onNavigate() }}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium"
      style={{ background: 'var(--color-blue-light)', color: 'var(--color-blue)' }}
    >
      <Link2 size={9} />
      詳細
    </button>
  )
}

function formatDuration(min: number | null): string {
  if (min == null) return '—'
  const m = Math.floor(min)
  const s = Math.round((min - m) * 60)
  return s > 0 ? `${m}分${s}秒` : `${m}分`
}

export default function CallsPage() {
  const router = useRouter()
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [q, setQ] = useState('')
  const [result, setResult] = useState('')

  const buildUrl = useCallback((q: string, result: string, p: number) => {
    const params = new URLSearchParams({ page: String(p) })
    if (q) params.set('q', q)
    if (result) params.set('result', result)
    return `/api/calls?${params}`
  }, [])

  const load = useCallback(async (q: string, result: string) => {
    setLoading(true)
    try {
      const res = await fetch(buildUrl(q, result, 1), { cache: 'no-store' })
      const json = await res.json() as { calls: Call[]; total: number; hasMore: boolean }
      setCalls(json.calls ?? [])
      setTotal(json.total ?? 0)
      setHasMore(json.hasMore ?? false)
      setPage(1)
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => { load(q, result) }, [q, result, load])

  async function loadMore() {
    const next = page + 1
    const res = await fetch(buildUrl(q, result, next), { cache: 'no-store' })
    const json = await res.json() as { calls: Call[]; hasMore: boolean }
    setCalls((prev) => [...prev, ...(json.calls ?? [])])
    setHasMore(json.hasMore ?? false)
    setPage(next)
  }

  const w = COL_WIDTHS

  return (
    <div className="p-6" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
            コール履歴
          </h1>
          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: 'var(--color-gray-400)' }}>
            {total.toLocaleString()} 件
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="relative">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--color-gray-400)' }} />
          <input
            type="text"
            placeholder="担当者名・アポ情報で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-lg border pl-8 pr-3 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)', width: 220 }}
          />
        </div>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-[13px]"
          style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
        >
          <option value="">架電結果（全て）</option>
          {RESULT_OPTIONS.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div
        className="rounded-xl border overflow-hidden overflow-x-auto"
        style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}
      >
        <table
          className="text-[11px] border-collapse"
          style={{ tableLayout: 'fixed', width: TOTAL_WIDTH, minWidth: TOTAL_WIDTH }}
        >
          <thead>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              <Th label="詳細"     w={w.list_link}   center />
              <Th label="架電日"   w={w.call_date} />
              <Th label="時刻"     w={w.call_time} />
              <Th label="会社名"   w={w.company_name} />
              <Th label="代表名"   w={w.rep_name} />
              <Th label="電話番号" w={w.phone} />
              <Th label="架電結果" w={w.call_result} />
              <Th label="通話時間" w={w.duration}    center />
              <Th label="担当者"   w={w.agent_name} />
              <Th label="Lvl"      w={w.rep_level}   center />
              <Th label="カテゴリ" w={w.category} />
              <Th label="アポ情報" w={w.appo_detail} />
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
            {!loading && calls.length === 0 && (
              <tr>
                <td colSpan={12} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  データがありません（FMから同期中の場合はしばらくお待ちください）
                </td>
              </tr>
            )}
            {!loading && calls.map((call, index) => {
              const lr = call.list_records
              const phone = lr?.phone_numbers?.[0] ?? null
              return (
                <tr
                  key={`${call.id}-${index}`}
                  style={{ borderBottom: '1px solid var(--color-gray-200)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-gray-50)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <td
                    className="px-2 py-1.5 text-[11px] align-middle text-center"
                    style={{ width: w.list_link, minWidth: w.list_link, maxWidth: w.list_link }}
                  >
                    <ListLinkBadge
                      listRecordId={call.list_record_id}
                      onNavigate={() => router.push(`/list/${call.list_record_id}`)}
                    />
                  </td>
                  <Td value={call.call_date}                  w={w.call_date} />
                  <Td value={call.call_start_time?.slice(0, 5) ?? null} w={w.call_time} />
                  <Td value={lr?.company_name ?? null}        w={w.company_name} />
                  <Td value={lr?.representative_name ?? null} w={w.rep_name} />
                  <Td value={phone}                           w={w.phone} />
                  <td
                    className="px-2 py-1.5 text-[11px] align-middle"
                    style={{ width: w.call_result, minWidth: w.call_result, maxWidth: w.call_result }}
                  >
                    <ResultBadge result={call.call_result} />
                  </td>
                  <Td value={formatDuration(call.call_duration_minutes)} w={w.duration} center />
                  <Td value={call.agent_name}                w={w.agent_name} />
                  <Td value={call.rep_level}                 w={w.rep_level}  center />
                  <Td value={call.call_category}             w={w.category} />
                  <Td value={call.appo_detail}               w={w.appo_detail} />
                </tr>
              )
            })}
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
