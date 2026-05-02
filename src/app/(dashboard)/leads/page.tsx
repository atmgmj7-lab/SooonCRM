'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Link2 } from 'lucide-react'

type Lead = {
  id: string
  list_record_id: string | null
  inquiry_date: string | null
  ad_name: string | null
  company_name: string | null
  rep_title: string | null
  representative_name: string | null
  email_address: string | null
  phone_number: string | null
  prefecture: string | null
  last_call_result: string | null
  completion_progress: string | null
  call_count: string | number | null
  recall_date: string | null
  recall_time: string | null
  adjusting: boolean | null
  jitsuyo_ok: boolean | null
  ichiyou_ng: boolean | null
  order_closed: boolean | null
}

const RESULT_OPTIONS = ['', 'アポOK', 'NG', '留守', '対象外', '再コール', '思案中', 'ポータルサイト']

const COL_WIDTHS = {
  list_record_id:       64,
  inquiry_date:         88,
  ad_name:             150,
  company_name:        130,
  rep_title:            72,
  representative_name:  96,
  email_address:       140,
  phone_number:        112,
  prefecture:           68,
  last_call_result:     84,
  completion_progress:  68,
  call_count:           52,
  recall_date:          84,
  recall_time:          60,
  adjusting:            60,
  jitsuyo_ok:           68,
  ichiyou_ng:           60,
  order_closed:         52,
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

function ListLinkBadge({ listRecordId, onNavigate }: { listRecordId: string | null; onNavigate: () => void }) {
  if (!listRecordId) return <span style={{ color: 'var(--color-gray-200)' }}>—</span>
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onNavigate() }}
      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium cursor-pointer"
      style={{ background: 'var(--color-blue-light)', color: 'var(--color-blue)' }}
    >
      <Link2 size={9} />
      追加済
    </button>
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

function BoolBadge({ value, label, color }: { value: boolean | null; label: string; color: string }) {
  if (!value) return <span style={{ color: 'var(--color-gray-200)' }}>—</span>
  return (
    <span
      className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
      style={{ background: `var(--color-${color}-bg)`, color: `var(--color-${color})` }}
    >
      {label}
    </span>
  )
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
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
    return `/api/leads?${params}`
  }, [])

  const load = useCallback(async (q: string, result: string) => {
    setLoading(true)
    try {
      const res = await fetch(buildUrl(q, result, 1), { cache: 'no-store' })
      const json = await res.json() as { leads: Lead[]; total: number; hasMore: boolean }
      setLeads(json.leads ?? [])
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
    const json = await res.json() as { leads: Lead[]; hasMore: boolean }
    setLeads((prev) => [...prev, ...(json.leads ?? [])])
    setHasMore(json.hasMore ?? false)
    setPage(next)
  }

  const w = COL_WIDTHS

  return (
    <div className="p-6" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
            リード一覧
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
            placeholder="会社名・代表名・電話番号で検索"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-lg border pl-8 pr-3 py-1.5 text-[13px]"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)', width: 240 }}
          />
        </div>
        <select
          value={result}
          onChange={(e) => setResult(e.target.value)}
          className="rounded-lg border px-3 py-1.5 text-[13px]"
          style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
        >
          <option value="">架電結果（全て）</option>
          {RESULT_OPTIONS.filter(Boolean).map((o) => (
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
              <Th label="リスト"         w={w.list_record_id} center />
              <Th label="問い合わせ日"   w={w.inquiry_date} />
              <Th label="広告名"         w={w.ad_name} />
              <Th label="会社名"         w={w.company_name} />
              <Th label="役職"           w={w.rep_title} />
              <Th label="代表名"         w={w.representative_name} />
              <Th label="メール"         w={w.email_address} />
              <Th label="電話番号"       w={w.phone_number} />
              <Th label="都道府県"       w={w.prefecture} />
              <Th label="架電結果"       w={w.last_call_result} />
              <Th label="完了進捗"       w={w.completion_progress} />
              <Th label="コール数"       w={w.call_count} />
              <Th label="再コール日"     w={w.recall_date} />
              <Th label="再時間"         w={w.recall_time} />
              <Th label="調整中"         w={w.adjusting} center />
              <Th label="採用OK"         w={w.jitsuyo_ok} center />
              <Th label="採用NG"         w={w.ichiyou_ng} center />
              <Th label="受注"           w={w.order_closed} center />
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={18} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--color-gray-400)' }}>
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={18} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  データがありません
                </td>
              </tr>
            )}
            {!loading && leads.map((lead, index) => (
              <tr
                key={`${lead.id}-${index}`}
                style={{ borderBottom: '1px solid var(--color-gray-200)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-gray-50)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td
                  className="px-2 py-1.5 text-[11px] align-middle text-center"
                  style={{ width: w.list_record_id, minWidth: w.list_record_id, maxWidth: w.list_record_id }}
                >
                  <ListLinkBadge
                    listRecordId={lead.list_record_id}
                    onNavigate={() => router.push(`/list/${lead.list_record_id}`)}
                  />
                </td>
                <Td value={lead.inquiry_date}          w={w.inquiry_date} />
                <Td value={lead.ad_name}               w={w.ad_name} />
                <Td value={lead.company_name}          w={w.company_name} />
                <Td value={lead.rep_title}             w={w.rep_title} />
                <Td value={lead.representative_name}   w={w.representative_name} />
                <Td value={lead.email_address}         w={w.email_address} />
                <Td value={lead.phone_number}          w={w.phone_number} />
                <Td value={lead.prefecture}            w={w.prefecture} />
                <td
                  className="px-2 py-1.5 text-[11px] align-middle"
                  style={{ width: w.last_call_result, minWidth: w.last_call_result, maxWidth: w.last_call_result }}
                >
                  <ResultBadge result={lead.last_call_result} />
                </td>
                <Td value={lead.completion_progress}   w={w.completion_progress} />
                <td
                  className="px-2 py-1.5 text-[11px] align-middle tabular-nums text-right"
                  style={{ width: w.call_count, minWidth: w.call_count, maxWidth: w.call_count, color: 'var(--color-gray-600)' }}
                >
                  {lead.call_count != null ? Number(lead.call_count) : '—'}
                </td>
                <Td value={lead.recall_date}           w={w.recall_date} />
                <Td value={lead.recall_time}           w={w.recall_time} />
                <td
                  className="px-2 py-1.5 text-[11px] align-middle text-center"
                  style={{ width: w.adjusting, minWidth: w.adjusting, maxWidth: w.adjusting }}
                >
                  <BoolBadge value={lead.adjusting}    label="調整中" color="warning" />
                </td>
                <td
                  className="px-2 py-1.5 text-[11px] align-middle text-center"
                  style={{ width: w.jitsuyo_ok, minWidth: w.jitsuyo_ok, maxWidth: w.jitsuyo_ok }}
                >
                  <BoolBadge value={lead.jitsuyo_ok}   label="採用OK" color="success" />
                </td>
                <td
                  className="px-2 py-1.5 text-[11px] align-middle text-center"
                  style={{ width: w.ichiyou_ng, minWidth: w.ichiyou_ng, maxWidth: w.ichiyou_ng }}
                >
                  <BoolBadge value={lead.ichiyou_ng}   label="採用NG" color="danger" />
                </td>
                <td
                  className="px-2 py-1.5 text-[11px] align-middle text-center"
                  style={{ width: w.order_closed, minWidth: w.order_closed, maxWidth: w.order_closed }}
                >
                  <BoolBadge value={lead.order_closed} label="受注"   color="success" />
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
