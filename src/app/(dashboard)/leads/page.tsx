'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Link2 } from 'lucide-react'
import { StatusSelect } from '@/components/list/StatusSelect'

type Lead = {
  id: string
  list_record_id: string | null
  inquiry_date: string | null
  ad_name: string | null
  company_name: string | null
  representative_name: string | null
  prefecture: string | null
  phone_number: string | null
  status: string | null
  last_call_result: string | null
  appo_detail_status: string | null
}

type TabKey = 'all' | 'new' | 'done'

function daysElapsed(inquiryDate: string | null): number | null {
  if (!inquiryDate) return null
  const d = new Date(inquiryDate)
  if (Number.isNaN(d.getTime())) return null
  const today = new Date()
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.floor((end.getTime() - start.getTime()) / 86400000)
}

const COL_WIDTHS = {
  list_record_id:      72,
  inquiry_date:        96,
  ad_name:            160,
  company_name:       140,
  representative_name: 100,
  prefecture:          72,
  phone_number:       120,
  elapsed:             72,
  status:             120,
} as const

const TOTAL_WIDTH = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0)

function Th({ label, w }: { label: string; w: number }) {
  return (
    <th
      className="px-2 py-2.5 text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left"
      style={{ color: 'var(--color-gray-600)', width: w, minWidth: w, maxWidth: w }}
    >
      {label}
    </th>
  )
}

function Td({ children, w }: { children: React.ReactNode; w: number }) {
  return (
    <td
      className="px-2 py-1.5 text-[11px] overflow-hidden whitespace-nowrap text-ellipsis align-middle"
      style={{ width: w, minWidth: w, maxWidth: w, color: 'var(--color-gray-700)' }}
    >
      {children}
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
      リスト
    </button>
  )
}

function ElapsedCell({ days }: { days: number | null }) {
  if (days == null) return <span style={{ color: 'var(--color-gray-300)' }}>—</span>
  let color = 'var(--color-success)'
  let fontWeight: 500 | 700 = 500
  if (days >= 7) {
    color = 'var(--color-danger)'
    fontWeight = 700
  } else if (days >= 3) {
    color = 'var(--color-warning)'
  }
  return (
    <span className="tabular-nums" style={{ color, fontWeight }}>
      {days}日
    </span>
  )
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [newLeadCount, setNewLeadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [appoDetailFilledTotal, setAppoDetailFilledTotal] = useState<number | null>(null)

  const buildUrl = useCallback((qStr: string, tabKey: TabKey, p: number) => {
    const params = new URLSearchParams({ page: String(p), tab: tabKey })
    if (qStr) params.set('q', qStr)
    return `/api/leads?${params}`
  }, [])

  const load = useCallback(async (qStr: string, tabKey: TabKey) => {
    setLoading(true)
    try {
      const res = await fetch(buildUrl(qStr, tabKey, 1), { cache: 'no-store' })
      const json = await res.json() as {
        leads: Lead[]
        total: number
        hasMore: boolean
        newLeadCount?: number
        appoDetailFilledTotal?: number
      }
      setLeads(json.leads ?? [])
      setTotal(json.total ?? 0)
      setAppoDetailFilledTotal(json.appoDetailFilledTotal ?? null)
      setHasMore(json.hasMore ?? false)
      setNewLeadCount(json.newLeadCount ?? 0)
      setPage(1)
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => { void load(q, tab) }, [q, tab, load])

  async function loadMore() {
    const next = page + 1
    const res = await fetch(buildUrl(q, tab, next), { cache: 'no-store' })
    const json = await res.json() as { leads: Lead[]; hasMore: boolean }
    setLeads((prev) => [...prev, ...(json.leads ?? [])])
    setHasMore(json.hasMore ?? false)
    setPage(next)
  }

  const w = COL_WIDTHS
  const colCount = Object.keys(COL_WIDTHS).length + 1

  return (
    <div className="p-6" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
            リード一覧
          </h1>
          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: 'var(--color-gray-400)' }}>
            {total.toLocaleString()} 件
            {appoDetailFilledTotal != null && (
              <> · アポOK内訳あり {appoDetailFilledTotal.toLocaleString()} 件</>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-3">
        <div className="flex rounded-lg border p-0.5" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
          {([
            ['all', '全リード'],
            ['new', `新規リード 🔴${newLeadCount.toLocaleString()}件`],
            ['done', '対応済み'],
          ] as const).map(([key, label]) => {
            const active = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className="px-3 py-1.5 text-[13px] font-medium rounded-md"
                style={{
                  background: active ? 'var(--color-gray-100)' : 'transparent',
                  color: active ? 'var(--color-gray-900)' : 'var(--color-gray-500)',
                }}
              >
                {label}
              </button>
            )
          })}
        </div>
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
              <Th label="リスト" w={w.list_record_id} />
              <Th label="問い合わせ日" w={w.inquiry_date} />
              <Th label="広告名" w={w.ad_name} />
              <Th label="会社名" w={w.company_name} />
              <Th label="代表名" w={w.representative_name} />
              <Th label="都道府県" w={w.prefecture} />
              <Th label="電話番号" w={w.phone_number} />
              <Th label="経過日数" w={w.elapsed} />
              <Th label="対応" w={w.status} />
              <th
                style={{
                  padding: '8px 12px',
                  fontSize: 11,
                  color: '#6B7280',
                  whiteSpace: 'nowrap',
                  borderLeft: '2px solid #E5E7EB',
                }}
              >
                アポOK内訳
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={colCount} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--color-gray-400)' }}>
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={colCount} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  データがありません
                </td>
              </tr>
            )}
            {!loading && leads.map((lead, index) => (
              <tr
                key={`${lead.id}-${index}`}
                style={{ borderBottom: '1px solid var(--color-gray-200)' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--color-gray-50)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
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
                <Td w={w.inquiry_date}>{lead.inquiry_date ?? '—'}</Td>
                <Td w={w.ad_name}><span title={lead.ad_name ?? ''}>{lead.ad_name ?? '—'}</span></Td>
                <Td w={w.company_name}>{lead.company_name ?? '—'}</Td>
                <Td w={w.representative_name}>{lead.representative_name ?? '—'}</Td>
                <Td w={w.prefecture}>{lead.prefecture ?? '—'}</Td>
                <Td w={w.phone_number}><span className="tabular-nums">{lead.phone_number ?? '—'}</span></Td>
                <Td w={w.elapsed}>
                  <ElapsedCell days={daysElapsed(lead.inquiry_date)} />
                </Td>
                <td className="px-1 py-1 align-middle" style={{ width: w.status, minWidth: w.status, maxWidth: w.status }}>
                  <StatusSelect
                    leadId={lead.id}
                    value={lead.status ?? lead.last_call_result ?? '新規'}
                    size="sm"
                    onUpdate={(s) => {
                      setLeads((prev) =>
                        prev.map((l) => (l.id === lead.id ? { ...l, status: s, last_call_result: s } : l)),
                      )
                    }}
                  />
                </td>
                <td style={{ padding: '8px 12px', borderLeft: '2px solid #E5E7EB' }}>
                  {lead.appo_detail_status ? (
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        background:
                          lead.appo_detail_status === '受注'
                            ? '#D1FAE5'
                            : lead.appo_detail_status === '採用OK'
                              ? '#DBEAFE'
                              : lead.appo_detail_status === '採用NG'
                                ? '#FEE2E2'
                                : lead.appo_detail_status === '調整中'
                                  ? '#FEF3C7'
                                  : '#F3F4F6',
                        color:
                          lead.appo_detail_status === '受注'
                            ? '#065F46'
                            : lead.appo_detail_status === '採用OK'
                              ? '#1E40AF'
                              : lead.appo_detail_status === '採用NG'
                                ? '#991B1B'
                                : lead.appo_detail_status === '調整中'
                                  ? '#92400E'
                                  : '#6B7280',
                      }}
                    >
                      {lead.appo_detail_status}
                    </span>
                  ) : (
                    <span style={{ color: '#E5E7EB' }}>—</span>
                  )}
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
