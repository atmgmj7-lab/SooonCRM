'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type WebhookLead = {
  id: string
  ad_name: string | null
  source: string | null
  status: string
  match_status: string | null
  added_to_list_id: string | null
  created_at: string
  raw_data: Record<string, unknown> | null
  // list_records から結合
  company_name?: string | null
  representative_name?: string | null
  prefecture?: string | null
  phone?: string | null
  fm_synced?: boolean
}

const statusLabel: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: '未処理',    bg: '#FEF9C3', color: '#854D0E' },
  added:   { label: 'リード済み', bg: '#DCFCE7', color: '#166534' },
  failed:  { label: 'エラー',    bg: '#FEE2E2', color: '#991B1B' },
}

function extractPhone(rawData: Record<string, unknown> | null): string {
  if (!rawData) return '—'
  const fd = rawData.field_data as Array<{ name: string; values: string[] }> | undefined
  if (fd) {
    const f = fd.find(f => ['phone_number', 'phone', '電話番号'].includes(f.name))
    return f?.values?.[0] ?? '—'
  }
  return String(rawData.phone_number ?? rawData.phone ?? '—')
}

function extractField(rawData: Record<string, unknown> | null, ...keys: string[]): string {
  if (!rawData) return '—'
  const fd = rawData.field_data as Array<{ name: string; values: string[] }> | undefined
  if (fd) {
    for (const k of keys) {
      const f = fd.find(f => f.name === k)
      if (f?.values?.[0]) return f.values[0]
    }
  }
  for (const k of keys) {
    const v = rawData[k]
    if (v) return String(v)
  }
  return '—'
}

const tdBase = 'px-3 py-2 text-[12px] whitespace-nowrap align-middle'

export default function NewLeadsTab() {
  const [leads, setLeads]       = useState<WebhookLead[]>([])
  const [loading, setLoading]   = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [pushing, setPushing]   = useState(false)
  const [result, setResult]     = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    setResult(null)
    const supabase = createClient()

    // webhook_leads を新しい順で取得
    const { data: wls } = await supabase
      .from('webhook_leads')
      .select('id, ad_name, source, status, match_status, added_to_list_id, created_at, raw_data')
      .order('created_at', { ascending: false })
      .limit(200)

    if (!wls) { setLoading(false); return }

    // added_to_list_id がある場合、list_records から情報を補完
    const listIds = wls.map(w => w.added_to_list_id).filter(Boolean) as string[]
    const lrMap = new Map<string, { company_name: string | null; representative_name: string | null; prefecture: string | null; phone_numbers: string[] | null; fm_record_id: string | null }>()

    if (listIds.length > 0) {
      const { data: lrs } = await supabase
        .from('list_records')
        .select('id, company_name, representative_name, prefecture, phone_numbers, fm_record_id')
        .in('id', listIds)
      lrs?.forEach(lr => lrMap.set(lr.id, lr))
    }

    const enriched: WebhookLead[] = wls.map(wl => {
      const lr = wl.added_to_list_id ? lrMap.get(wl.added_to_list_id) : undefined
      return {
        ...wl,
        company_name:        lr?.company_name ?? extractField(wl.raw_data, 'company_name', '会社名'),
        representative_name: lr?.representative_name ?? extractField(wl.raw_data, 'full_name', '代表名'),
        prefecture:          lr?.prefecture ?? extractField(wl.raw_data, 'state', '都道府県', '県名'),
        phone:               (lr?.phone_numbers?.[0]) ?? extractPhone(wl.raw_data),
        fm_synced:           !!lr?.fm_record_id,
      }
    })

    setLeads(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(leads.map(l => l.id)))
    else setSelected(new Set())
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function pushSelected() {
    if (selected.size === 0) return
    setPushing(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/push-webhook-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selected) }),
      })
      const json = await res.json() as { ok: boolean; created: number; fm_created: number; fm_linked: number; failed: number }
      setResult(
        `完了: リード新規 ${json.created}件 / FM新規登録 ${json.fm_created}件 / FMリンク ${json.fm_linked}件 / エラー ${json.failed}件`
      )
      await load()
    } finally {
      setPushing(false)
    }
  }

  const allSelected = leads.length > 0 && selected.size === leads.length
  const someSelected = selected.size > 0

  return (
    <div>
      {/* アクションバー */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[12px]" style={{ color: 'var(--color-gray-600)' }}>
          {leads.length} 件 {someSelected && `/ ${selected.size} 件選択中`}
        </span>
        <button
          onClick={pushSelected}
          disabled={!someSelected || pushing}
          className="rounded-lg px-4 py-1.5 text-[12px] font-semibold transition-opacity"
          style={{
            background: someSelected ? 'var(--color-blue)' : 'var(--color-gray-200)',
            color: someSelected ? '#fff' : 'var(--color-gray-400)',
            opacity: pushing ? 0.6 : 1,
            cursor: someSelected && !pushing ? 'pointer' : 'not-allowed',
          }}
        >
          {pushing ? '送信中…' : '選択してリード & FM登録'}
        </button>
        <button
          onClick={load}
          className="rounded-lg px-3 py-1.5 text-[12px] border"
          style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-gray-600)' }}
        >
          更新
        </button>
        {result && (
          <span className="text-[12px] font-medium" style={{ color: 'var(--color-success)' }}>
            {result}
          </span>
        )}
      </div>

      {/* テーブル */}
      <div
        className="rounded-xl border overflow-hidden overflow-x-auto"
        style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}
      >
        <table className="text-[12px] border-collapse w-full" style={{ minWidth: 900 }}>
          <thead style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
            <tr>
              <th className="px-3 py-2.5 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={e => toggleAll(e.target.checked)}
                />
              </th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>受信日時</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>広告名</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>会社名</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>代表名</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>都道府県</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>電話番号</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>ステータス</th>
              <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider" style={{ color: 'var(--color-gray-600)' }}>FM同期</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[13px] animate-pulse" style={{ color: 'var(--color-gray-400)' }}>
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && leads.length === 0 && (
              <tr>
                <td colSpan={9} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  新規リードはありません
                </td>
              </tr>
            )}
            {!loading && leads.map((lead, idx) => {
              const st = statusLabel[lead.status] ?? { label: lead.status, bg: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }
              return (
                <tr
                  key={lead.id}
                  style={{
                    borderBottom: '1px solid var(--color-gray-200)',
                    background: selected.has(lead.id) ? '#EFF6FF' : idx % 2 === 1 ? '#f9fafb' : '#ffffff',
                  }}
                >
                  <td className={tdBase} onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleOne(lead.id)}
                    />
                  </td>
                  <td className={`${tdBase} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                    {lead.created_at.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className={tdBase} style={{ color: 'var(--color-gray-700)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
                    {lead.phone ?? '—'}
                  </td>
                  <td className={tdBase}>
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[11px] font-medium"
                      style={{ background: st.bg, color: st.color }}
                    >
                      {st.label}
                    </span>
                  </td>
                  <td className={tdBase}>
                    {lead.fm_synced
                      ? <span className="text-[11px]" style={{ color: 'var(--color-success)' }}>✓ 同期済み</span>
                      : <span className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>未同期</span>
                    }
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
