'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Link2, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { StatusSelect } from '@/components/list/StatusSelect'
import { AppoStatusSelect } from '@/components/shared/AppoStatusSelect'
import { ColumnFilter } from '@/components/shared/ColumnFilter'

type Lead = {
  id: string
  list_record_id: string | null
  inquiry_date: string | null
  inquiry_at: string | null
  ad_name: string | null
  company_name: string | null
  representative_name: string | null
  prefecture: string | null
  phone_number: string | null
  status: string | null
  appo_detail_status: string | null
  juchu?: boolean | null
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
  checkbox:            32,
  list_record_id:      72,
  inquiry_date:        96,
  ad_name:            160,
  company_name:       140,
  representative_name: 100,
  prefecture:          72,
  phone_number:       120,
  elapsed:             72,
  status:             120,
  appo_detail:        240,
} as const

const TOTAL_WIDTH = Object.values(COL_WIDTHS).reduce((a, b) => a + b, 0)

type SortCol = 'created_at' | 'inquiry_at' | 'ad_name' | 'company_name' | 'prefecture' | 'status'

function Th({
  label, w, col, sortCol, sortDir, onSort,
}: {
  label: string; w: number
  col?: SortCol
  sortCol?: SortCol
  sortDir?: 'asc' | 'desc'
  onSort?: (col: SortCol) => void
}) {
  const active = col && sortCol === col
  return (
    <th
      className="px-2 py-2.5 text-[11px] font-medium whitespace-nowrap overflow-hidden text-ellipsis text-left select-none"
      style={{
        color: active ? 'var(--color-blue)' : 'var(--color-gray-600)',
        width: w, minWidth: w, maxWidth: w,
        cursor: col ? 'pointer' : 'default',
      }}
      onClick={() => col && onSort?.(col)}
    >
      <span className="inline-flex items-center gap-0.5">
        {label}
        {col && (
          active
            ? (sortDir === 'asc' ? <ChevronUp size={10} /> : <ChevronDown size={10} />)
            : <ChevronsUpDown size={10} style={{ opacity: 0.3 }} />
        )}
      </span>
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

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- UIはdistinct由来; マスタ行列表記の正として保持
const STATUSES = ['新規', '未対応', '架電中', 'アポOK', '保留', '留守', 'NG', '受注']

function Pagination({ page, totalPages, onChange }: { page: number; totalPages: number; onChange: (p: number) => void }) {
  if (totalPages <= 1) return null
  const pages: (number | '…')[] = []
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i)
  } else {
    pages.push(1)
    if (page > 3) pages.push('…')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i)
    if (page < totalPages - 2) pages.push('…')
    pages.push(totalPages)
  }
  const btnBase: React.CSSProperties = { minWidth: 32, height: 32, borderRadius: 6, fontSize: 12, border: '1px solid var(--color-gray-200)', cursor: 'pointer', padding: '0 6px', background: 'var(--color-white)' }
  return (
    <div className="flex items-center gap-1 justify-center mt-4">
      <button type="button" disabled={page <= 1} onClick={() => onChange(page - 1)}
        style={{ ...btnBase, color: page <= 1 ? 'var(--color-gray-300)' : 'var(--color-gray-700)', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
        ‹
      </button>
      {pages.map((p, i) => (
        <button key={`${p}-${i}`} type="button" disabled={p === '…'} onClick={() => typeof p === 'number' && onChange(p)}
          style={{ ...btnBase, background: p === page ? 'var(--color-blue)' : 'var(--color-white)', color: p === page ? '#fff' : p === '…' ? 'var(--color-gray-400)' : 'var(--color-gray-700)', cursor: p === '…' ? 'default' : 'pointer', borderColor: p === page ? 'var(--color-blue)' : 'var(--color-gray-200)' }}>
          {p}
        </button>
      ))}
      <button type="button" disabled={page >= totalPages} onClick={() => onChange(page + 1)}
        style={{ ...btnBase, color: page >= totalPages ? 'var(--color-gray-300)' : 'var(--color-gray-700)', cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>
        ›
      </button>
    </div>
  )
}

export default function LeadsPage() {
  const router = useRouter()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [newLeadCount, setNewLeadCount] = useState(0)
  const [page, setPage] = useState(1)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState<TabKey>('all')
  const [appoDetailFilledTotal, setAppoDetailFilledTotal] = useState<number | null>(null)
  const [juchuSavingId, setJuchuSavingId] = useState<string | null>(null)
  const [sortCol, setSortCol] = useState<SortCol>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [selectedAdNames, setSelectedAdNames] = useState<string[]>([])
  const [selectedPrefectures, setSelectedPrefectures] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [adNameValues, setAdNameValues] = useState<string[]>([])
  const [prefectureValues, setPrefectureValues] = useState<string[]>([])
  const [statusValues, setStatusValues] = useState<string[]>([])
  const [distinctLoading, setDistinctLoading] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkDeleting, setBulkDeleting] = useState(false)

  const buildUrl = useCallback((qStr: string, tabKey: TabKey, p: number, col: SortCol, dir: string, adNames: string[], prefectures: string[], statuses: string[]) => {
    const params = new URLSearchParams({ page: String(p), tab: tabKey, sort_col: col, sort_dir: dir })
    if (qStr)             params.set('q', qStr)
    if (adNames.length)   params.set('ad_names', adNames.join(','))
    if (prefectures.length) params.set('prefectures', prefectures.join(','))
    if (statuses.length)  params.set('statuses', statuses.join(','))
    return `/api/leads?${params}`
  }, [])

  const load = useCallback(async (qStr: string, tabKey: TabKey, p: number, col: SortCol, dir: string, adNames: string[], prefectures: string[], statuses: string[]) => {
    setLoading(true)
    try {
      const res = await fetch(buildUrl(qStr, tabKey, p, col, dir, adNames, prefectures, statuses), { cache: 'no-store' })
      const json = await res.json() as {
        leads: Lead[]
        total: number
        pagination?: { totalPages: number }
        newLeadCount?: number
        appoDetailFilledTotal?: number
      }
      setLeads(json.leads ?? [])
      setTotal(json.total ?? 0)
      setTotalPages(json.pagination?.totalPages ?? 1)
      setAppoDetailFilledTotal(json.appoDetailFilledTotal ?? null)
      setNewLeadCount(json.newLeadCount ?? 0)
    } finally {
      setLoading(false)
    }
  }, [buildUrl])

  useEffect(() => {
    async function fetchDistinct() {
      setDistinctLoading(true)
      const [adRes, prefRes, stRes] = await Promise.all([
        fetch('/api/leads/distinct-values?column=ad_name'),
        fetch('/api/leads/distinct-values?column=prefecture'),
        fetch('/api/leads/distinct-values?column=status'),
      ])
      const [adJson, prefJson, stJson] = await Promise.all([
        adRes.json() as Promise<{ values: string[] }>,
        prefRes.json() as Promise<{ values: string[] }>,
        stRes.json() as Promise<{ values: string[] }>,
      ])
      setAdNameValues(adJson.values ?? [])
      setPrefectureValues(prefJson.values ?? [])
      setStatusValues(stJson.values ?? [])
      setDistinctLoading(false)
    }
    void fetchDistinct()
  }, [])

  useEffect(() => {
    setPage(1)
    void load(q, tab, 1, sortCol, sortDir, selectedAdNames, selectedPrefectures, selectedStatuses)
  }, [q, tab, sortCol, sortDir, selectedAdNames, selectedPrefectures, selectedStatuses, load])

  useEffect(() => {
    void load(q, tab, page, sortCol, sortDir, selectedAdNames, selectedPrefectures, selectedStatuses)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  function handleSort(col: SortCol) {
    if (col === sortCol) {
      setSortDir((d) => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('desc')
    }
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return
    if (!confirm(`選択した ${selectedIds.size} 件のリードを削除します。この操作は元に戻せません。続行しますか？`)) return
    setBulkDeleting(true)
    try {
      const res = await fetch('/api/leads/bulk-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [...selectedIds] }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        alert(body.error ?? '削除に失敗しました')
        return
      }
      setSelectedIds(new Set())
      void load(q, tab, page, sortCol, sortDir, selectedAdNames, selectedPrefectures, selectedStatuses)
    } finally {
      setBulkDeleting(false)
    }
  }

  async function patchLeadJuchu(leadId: string, next: boolean) {
    setJuchuSavingId(leadId)
    try {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ juchu: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        alert(body.error ?? `更新失敗 (${res.status})`)
        return
      }
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, juchu: next } : l)))
    } finally {
      setJuchuSavingId(null)
    }
  }

  const w = COL_WIDTHS
  const colCount = Object.keys(COL_WIDTHS).length

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

      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <span className="text-[12px]" style={{ color: 'var(--color-gray-600)' }}>
            {selectedIds.size}件選択中
          </span>
          <button
            type="button"
            onClick={() => void handleBulkDelete()}
            disabled={bulkDeleting}
            className="rounded px-3 py-1 text-[12px] font-medium"
            style={{ background: 'var(--color-danger)', color: 'var(--color-white)', opacity: bulkDeleting ? 0.6 : 1 }}
          >
            {bulkDeleting ? '削除中...' : `${selectedIds.size}件削除`}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="rounded px-2 py-1 text-[11px]"
            style={{ color: 'var(--color-gray-600)', border: '1px solid var(--color-gray-200)' }}
          >
            選択解除
          </button>
        </div>
      )}

      <div
        className="rounded-xl border overflow-x-auto w-full"
        style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}
      >
        <table
          className="text-[11px] border-collapse w-full"
          style={{
            tableLayout: 'fixed',
            width: '100%',
            minWidth: Math.max(1200, TOTAL_WIDTH),
          }}
        >
          <thead>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              <th
                className="px-2 py-2.5 text-center align-middle"
                style={{ width: w.checkbox, minWidth: w.checkbox, maxWidth: w.checkbox }}
              >
                <input
                  type="checkbox"
                  checked={leads.length > 0 && leads.every((l) => selectedIds.has(l.id))}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedIds(new Set(leads.map((l) => l.id)))
                    } else {
                      setSelectedIds(new Set())
                    }
                  }}
                  className="rounded border"
                  style={{ borderColor: 'var(--color-gray-400)' }}
                />
              </th>
              <Th label="リスト" w={w.list_record_id} />
              <Th label="問い合わせ日" w={w.inquiry_date} col="inquiry_at" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <Th label="広告名" w={w.ad_name} col="ad_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <Th label="会社名" w={w.company_name} col="company_name" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <Th label="代表名" w={w.representative_name} />
              <Th label="都道府県" w={w.prefecture} col="prefecture" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <Th label="電話番号" w={w.phone_number} />
              <Th label="経過日数" w={w.elapsed} />
              <Th label="対応" w={w.status} col="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} />
              <th
                className="px-3 py-2.5 text-[11px] font-medium text-left whitespace-nowrap border-l-2"
                style={{
                  color: 'var(--color-gray-600)',
                  width: w.appo_detail,
                  minWidth: w.appo_detail,
                  maxWidth: w.appo_detail,
                  borderColor: 'var(--color-gray-200)',
                }}
              >
                アポOK内訳
              </th>
            </tr>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              <td style={{ width: w.checkbox, minWidth: w.checkbox }} />
              <td style={{ width: w.list_record_id, minWidth: w.list_record_id }} />
              <td style={{ width: w.inquiry_date, minWidth: w.inquiry_date }} />
              <td className="px-1 py-1" style={{ width: w.ad_name, minWidth: w.ad_name }}>
                <ColumnFilter
                  label="広告名"
                  values={adNameValues}
                  selected={selectedAdNames}
                  onChange={setSelectedAdNames}
                  loading={distinctLoading}
                />
              </td>
              <td style={{ width: w.company_name, minWidth: w.company_name }} />
              <td style={{ width: w.representative_name, minWidth: w.representative_name }} />
              <td className="px-1 py-1" style={{ width: w.prefecture, minWidth: w.prefecture }}>
                <ColumnFilter
                  label="都道府県"
                  values={prefectureValues}
                  selected={selectedPrefectures}
                  onChange={setSelectedPrefectures}
                  loading={distinctLoading}
                />
              </td>
              <td style={{ width: w.phone_number, minWidth: w.phone_number }} />
              <td style={{ width: w.elapsed, minWidth: w.elapsed }} />
              <td className="px-1 py-1" style={{ width: w.status, minWidth: w.status }}>
                <ColumnFilter
                  label="対応"
                  values={statusValues}
                  selected={selectedStatuses}
                  onChange={setSelectedStatuses}
                  loading={distinctLoading}
                />
              </td>
              <td style={{ width: w.appo_detail, minWidth: w.appo_detail }} />
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
                  className="px-2 py-1.5 text-center align-middle"
                  style={{ width: w.checkbox, minWidth: w.checkbox, maxWidth: w.checkbox }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(lead.id)}
                    onChange={(e) => {
                      setSelectedIds((prev) => {
                        const next = new Set(prev)
                        if (e.target.checked) next.add(lead.id)
                        else next.delete(lead.id)
                        return next
                      })
                    }}
                    className="rounded border"
                    style={{ borderColor: 'var(--color-gray-400)' }}
                  />
                </td>
                <td
                  className="px-2 py-1.5 text-[11px] align-middle text-center"
                  style={{ width: w.list_record_id, minWidth: w.list_record_id, maxWidth: w.list_record_id }}
                >
                  <ListLinkBadge
                    listRecordId={lead.list_record_id}
                    onNavigate={() => router.push(`/list/${lead.list_record_id}`)}
                  />
                </td>
                <Td w={w.inquiry_date}>{lead.inquiry_date ?? lead.inquiry_at?.slice(0, 10) ?? '—'}</Td>
                <Td w={w.ad_name}><span title={lead.ad_name ?? ''}>{lead.ad_name ?? '—'}</span></Td>
                <Td w={w.company_name}>{lead.company_name ?? '—'}</Td>
                <Td w={w.representative_name}>{lead.representative_name ?? '—'}</Td>
                <Td w={w.prefecture}>{lead.prefecture ?? '—'}</Td>
                <Td w={w.phone_number}><span className="tabular-nums">{lead.phone_number ?? '—'}</span></Td>
                <Td w={w.elapsed}>
                  <ElapsedCell days={daysElapsed(lead.inquiry_date ?? lead.inquiry_at?.slice(0, 10) ?? null)} />
                </Td>
                <td className="px-1 py-1 align-middle" style={{ width: w.status, minWidth: w.status, maxWidth: w.status }}>
                  <StatusSelect
                    leadId={lead.id}
                    value={lead.status ?? '新規'}
                    size="sm"
                    onUpdate={(s) => {
                      setLeads((prev) =>
                        prev.map((l) => (l.id === lead.id ? { ...l, status: s } : l)),
                      )
                    }}
                  />
                </td>
                <td
                  className="px-3 py-1.5 align-middle border-l-2"
                  style={{
                    width: w.appo_detail,
                    minWidth: w.appo_detail,
                    maxWidth: w.appo_detail,
                    borderColor: 'var(--color-gray-200)',
                  }}
                >
                  {lead.status === 'アポOK' ? (
                    <div className="flex flex-wrap items-center gap-2">
                      <AppoStatusSelect
                        leadId={lead.id}
                        currentStatus={lead.status}
                        currentDetail={lead.appo_detail_status}
                        size="sm"
                onUpdate={(detail) => {
                  setLeads((prev) =>
                    prev.map((l) =>
                      l.id === lead.id
                        ? { ...l, appo_detail_status: detail, juchu: detail === '受注' }
                        : l,
                    ),
                  )
                }}
                      />
                      <label className="inline-flex items-center gap-1.5 shrink-0 cursor-pointer text-[11px]" style={{ color: 'var(--color-gray-900)' }}>
                        <input
                          type="checkbox"
                          checked={lead.juchu === true}
                          disabled={juchuSavingId === lead.id}
                          onChange={(e) => {
                            e.stopPropagation()
                            void patchLeadJuchu(lead.id, e.target.checked)
                          }}
                          className="rounded border align-middle"
                          style={{ borderColor: 'var(--color-gray-200)' }}
                        />
                        受注
                      </label>
                      {lead.juchu === true && (
                        <span
                          className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums shrink-0"
                          style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}
                        >
                          ✅受注
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-[11px]" style={{ color: 'var(--color-gray-300)' }}>
                      —
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} onChange={setPage} />
    </div>
  )
}
