'use client'

import { useCallback, useEffect, useState } from 'react'
import { Search } from 'lucide-react'

type Lead = {
  id: string
  inquiry_date: string | null
  ad_name: string | null
  company_name: string | null
  representative_name: string | null
  phone_number: string | null
  last_call_result: string | null
  list_record_id: string | null
  prefecture: string | null
}

const RESULT_OPTIONS = ['', 'アポOK', 'NG', '留守', '対象外', '再コール', '思案中', 'ポータルサイト']

const thBase = 'px-3 py-2.5 text-left text-[12px] font-medium whitespace-nowrap'
const tdBase = 'px-3 py-2 text-[12px] whitespace-nowrap align-middle'

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return <span style={{ color: 'var(--color-gray-400)' }}>—</span>
  const isAppo = result === 'アポOK'
  return (
    <span
      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
      style={{
        background: isAppo ? 'var(--color-success-bg)' : 'var(--color-gray-100)',
        color: isAppo ? 'var(--color-success)' : 'var(--color-gray-600)',
      }}
    >
      {result}
    </span>
  )
}

export default function LeadsPage() {
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

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
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

      <div className="flex flex-wrap items-center gap-2 mb-4">
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
          <option value="">対応結果（全て）</option>
          {RESULT_OPTIONS.filter(Boolean).map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
        <table className="text-[12px] border-collapse w-full" style={{ minWidth: 900 }}>
          <thead>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 96 }}>問い合わせ日</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 160 }}>広告名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 140 }}>会社名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }}>代表名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 80 }}>都道府県</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 120 }}>電話番号</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 110 }}>対応結果</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }}>FM紐づけ</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--color-gray-400)' }}>
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={8} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  データがありません
                </td>
              </tr>
            )}
            {!loading && leads.map((lead) => (
              <tr
                key={lead.id}
                style={{ borderBottom: '1px solid var(--color-gray-200)' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-gray-50)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                  {lead.inquiry_date ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-700)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lead.ad_name ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-900)', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {lead.company_name ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-700)' }}>
                  {lead.representative_name ?? '—'}
                </td>
                <td className={tdBase} style={{ color: 'var(--color-gray-600)' }}>
                  {lead.prefecture ?? '—'}
                </td>
                <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                  {lead.phone_number ?? '—'}
                </td>
                <td className={tdBase}>
                  <ResultBadge result={lead.last_call_result} />
                </td>
                <td className={tdBase}>
                  {lead.list_record_id ? (
                    <a
                      href={`/list/${lead.list_record_id}`}
                      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ background: 'var(--color-blue-light)', color: 'var(--color-blue)' }}
                    >
                      リスト紐づき済
                    </a>
                  ) : (
                    <span className="inline-block px-2 py-0.5 rounded text-[11px]" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-400)' }}>
                      未紐づけ
                    </span>
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
