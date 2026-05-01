'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PlusCircle, ListPlus, RefreshCw } from 'lucide-react'

type WebhookLead = {
  id: string
  tenant_id: string
  ad_name: string | null
  status: 'pending' | 'added'
  match_status?: 'matched' | 'unmatched' | 'pending' | null
  fm_record_id?: string | null
  added_to_list_id?: string | null
  received_at: string
  created_at: string
  raw_data: Record<string, unknown>
  mapped_data: Record<string, unknown>
}

type MatchFilter = 'all' | 'fm_synced' | 'linked' | 'unmatched' | 'pending'

const thBase = 'px-3 py-2.5 text-left text-[12px] font-medium whitespace-nowrap'
const tdBase = 'px-3 py-2 text-[12px] whitespace-nowrap align-middle'

export default function LeadsPage() {
  const [leads, setLeads] = useState<WebhookLead[]>([])
  const [loading, setLoading] = useState(true)
  const [addingId, setAddingId] = useState<string | null>(null)
  const [bulkAdding, setBulkAdding] = useState(false)
  const [rematching, setRematching] = useState(false)
  const [matchFilter, setMatchFilter] = useState<MatchFilter>('all')
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)

  const loadLeads = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhook-leads', { cache: 'no-store' })
      const json = await res.json() as { leads: WebhookLead[] }
      setLeads(json.leads ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadLeads()

    const supabase = createClient()
    const channel = supabase
      .channel('webhook_leads_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'webhook_leads' },
        () => { loadLeads() }
      )
      .subscribe()

    channelRef.current = channel
    return () => { supabase.removeChannel(channel) }
  }, [loadLeads])

  async function handleAddToList(id: string) {
    setAddingId(id)
    try {
      const res = await fetch('/api/webhook-leads/add-to-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) => l.id === id ? { ...l, status: 'added' } : l)
        )
      }
    } finally {
      setAddingId(null)
    }
  }

  async function handleBulkAdd() {
    setBulkAdding(true)
    try {
      const res = await fetch('/api/webhook-leads/add-to-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bulk: true }),
      })
      if (res.ok) {
        await loadLeads()
      }
    } finally {
      setBulkAdding(false)
    }
  }

  async function handleRematch() {
    setRematching(true)
    try {
      const res = await fetch('/api/leads/rematch', { method: 'POST' })
      if (res.ok) {
        await loadLeads()
      }
    } finally {
      setRematching(false)
    }
  }

  const pendingCount = leads.filter((l) => l.status === 'pending').length
  const unmatchedCount = leads.filter((l) => l.match_status === 'unmatched').length

  const filteredLeads = leads.filter((lead) => {
    switch (matchFilter) {
      case 'fm_synced':
        return !!lead.fm_record_id
      case 'linked':
        return !!lead.added_to_list_id && !lead.fm_record_id
      case 'unmatched':
        return lead.match_status === 'unmatched'
      case 'pending':
        return lead.match_status === 'pending'
      case 'all':
      default:
        return true
    }
  })

  function formatDateTime(dt: string): string {
    if (!dt) return '—'
    return dt.slice(0, 16).replace('T', ' ')
  }

  function str(v: unknown): string {
    return typeof v === 'string' && v ? v : ''
  }

  function pick(...candidates: unknown[]): string {
    for (const c of candidates) {
      const s = str(c)
      if (s) return s
    }
    return '—'
  }

  function renderMatchBadge(lead: WebhookLead) {
    if (lead.fm_record_id) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
          FM同期済
        </span>
      )
    }
    if (lead.added_to_list_id) {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: 'var(--color-blue-light)', color: 'var(--color-blue)' }}>
          リスト紐づき済
        </span>
      )
    }
    if (lead.match_status === 'unmatched') {
      return (
        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}>
          未紐づけ
        </span>
      )
    }
    return (
      <span className="inline-block px-2 py-0.5 rounded text-[11px] font-medium" style={{ background: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }}>
        照合待ち
      </span>
    )
  }

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
            Webhook リード受信
          </h1>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--color-gray-400)' }}>
            Meta広告フォームから受信したリード
          </p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2">
            {unmatchedCount > 0 && (
              <button
                type="button"
                onClick={handleRematch}
                disabled={rematching}
                className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
                style={{ background: 'var(--color-navy-mid)' }}
              >
                <RefreshCw size={14} className={rematching ? 'animate-spin' : ''} />
                {rematching ? '再照合中…' : `未紐づけを再照合（${unmatchedCount}件）`}
              </button>
            )}
            <button
              type="button"
              onClick={handleBulkAdd}
              disabled={bulkAdding}
              className="flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60"
              style={{ background: 'var(--color-blue)' }}
            >
              <ListPlus size={14} />
              {bulkAdding ? '追加中…' : `全件追加（${pendingCount}件）`}
            </button>
          </div>
        )}
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className="text-[12px]" style={{ color: 'var(--color-gray-600)' }}>FM紐づけ状態</span>
        <select
          value={matchFilter}
          onChange={(e) => setMatchFilter(e.target.value as MatchFilter)}
          className="rounded-lg border px-3 py-1.5 text-[13px]"
          style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-900)' }}
        >
          <option value="all">すべて</option>
          <option value="fm_synced">FM同期済</option>
          <option value="linked">リスト紐づき済</option>
          <option value="unmatched">未紐づけ</option>
          <option value="pending">照合待ち</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden overflow-x-auto" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
        <table className="text-[12px] border-collapse w-full" style={{ minWidth: 1200 }}>
          <thead>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 130 }}>受信日時</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 160 }}>広告名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 140 }}>会社名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }}>代表名</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 120 }}>電話番号</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 90 }}>都道府県</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 120 }}>FM紐づけ状態</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 180 }}>リスト情報</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 80 }}>ステータス</th>
              <th className={thBase} style={{ color: 'var(--color-gray-600)', minWidth: 100 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--color-gray-400)' }}>
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && filteredLeads.length === 0 && (
              <tr>
                <td colSpan={10} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  受信済みのリードはありません
                </td>
              </tr>
            )}
            {!loading && filteredLeads.map((lead) => {
              const isAdded = lead.status === 'added'
              const isAdding = addingId === lead.id
              const raw = lead.raw_data ?? {}
              const mapped = lead.mapped_data ?? {}

              return (
                <tr
                  key={lead.id}
                  style={{
                    borderBottom: '1px solid var(--color-gray-200)',
                    opacity: isAdded ? 0.5 : 1,
                  }}
                >
                  <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                    {formatDateTime(lead.received_at)}
                  </td>
                  <td className={tdBase} style={{ color: 'var(--color-gray-700)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pick(lead.ad_name, mapped.ad_name, raw.ad_name)}
                  </td>
                  <td className={tdBase} style={{ color: 'var(--color-gray-900)', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {pick(mapped.company_name, raw.company_name)}
                  </td>
                  <td className={tdBase} style={{ color: 'var(--color-gray-700)' }}>
                    {pick(mapped.representative_name, raw.representative_name)}
                  </td>
                  <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                    {pick(
                      Array.isArray(mapped.phone_numbers) ? mapped.phone_numbers[0] : mapped.phone_numbers,
                      mapped.phone_number,
                      mapped.telephone,
                      raw.phone_number,
                      raw.phone,
                      raw['電話番号'],
                    )}
                  </td>
                  <td className={tdBase} style={{ color: 'var(--color-gray-600)' }}>
                    {pick(mapped.prefecture, mapped.県名, raw.prefecture, raw.県名)}
                  </td>
                  <td className={tdBase}>
                    {renderMatchBadge(lead)}
                  </td>
                  <td className={tdBase} style={{ color: 'var(--color-gray-700)' }}>
                    {lead.added_to_list_id ? (
                      <a href={`/list/${lead.added_to_list_id}`} className="underline">
                        {`${pick(raw.customer_id, mapped.customer_id, 'CS未設定')} / ${pick(mapped.company_name, raw.company_name)}`}
                      </a>
                    ) : '—'}
                  </td>
                  <td className={tdBase}>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{
                        background: isAdded ? 'var(--color-gray-100)' : 'var(--color-warning-bg)',
                        color: isAdded ? 'var(--color-gray-400)' : 'var(--color-warning)',
                      }}
                    >
                      {isAdded ? '追加済み' : '未追加'}
                    </span>
                  </td>
                  <td className={tdBase}>
                    {!isAdded && (
                      <button
                        type="button"
                        onClick={() => handleAddToList(lead.id)}
                        disabled={isAdding}
                        className="flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium disabled:opacity-60"
                        style={{ borderColor: 'var(--color-blue)', color: 'var(--color-blue)', background: 'transparent' }}
                      >
                        <PlusCircle size={11} />
                        {isAdding ? '追加中…' : 'リストに追加'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
