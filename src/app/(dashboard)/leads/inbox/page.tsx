'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

type FieldEntry = { name: string; values: string[] }

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
  is_duplicate?: boolean
}

const STATUS = {
  pending: { label: '未処理',  bg: '#FEF9C3', color: '#854D0E' },
  added:   { label: '処理済み', bg: '#DCFCE7', color: '#166534' },
  failed:  { label: 'エラー',   bg: '#FEE2E2', color: '#991B1B' },
} as const

function getFieldData(raw: Record<string, unknown> | null): FieldEntry[] {
  if (!raw) return []
  const fd = raw.field_data as FieldEntry[] | undefined
  return fd ?? []
}

function extractPhone(raw: Record<string, unknown> | null): string {
  if (!raw) return '—'
  const fd = raw.field_data as FieldEntry[] | undefined
  if (fd) {
    const f = fd.find(f => ['phone_number', 'phone', '電話番号'].includes(f.name))
    return f?.values?.[0] ?? '—'
  }
  return String(raw.phone_number ?? raw.phone ?? '—')
}

function extractField(raw: Record<string, unknown> | null, ...keys: string[]): string {
  if (!raw) return '—'
  const fd = raw.field_data as FieldEntry[] | undefined
  if (fd) {
    for (const k of keys) {
      const f = fd.find(f => f.name === k)
      if (f?.values?.[0]) return f.values[0]
    }
  }
  for (const k of keys) {
    const v = raw[k]
    if (v) return String(v)
  }
  return '—'
}

const th = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap'
const td = 'px-3 py-2 text-[12px] whitespace-nowrap align-middle'

type Tab = 'all' | 'pending' | 'added'

export default function InboxPage() {
  const [leads, setLeads]         = useState<WebhookLead[]>([])
  const [loading, setLoading]     = useState(true)
  const [tab, setTab]             = useState<Tab>('all')
  const [selected, setSelected]   = useState<Set<string>>(new Set())
  const [pushing, setPushing]     = useState(false)
  const [result, setResult]       = useState<string | null>(null)
  const [modal, setModal]         = useState<WebhookLead | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setSelected(new Set())
    setResult(null)
    const supabase = createClient()

    const { data: wls } = await supabase
      .from('webhook_leads')
      .select('id, ad_name, source, status, match_status, added_to_list_id, created_at, raw_data')
      .order('created_at', { ascending: false })
      .limit(300)

    if (!wls) { setLoading(false); return }

    const listIds = wls.map(w => w.added_to_list_id).filter(Boolean) as string[]
    const lrMap = new Map<string, {
      company_name: string | null
      representative_name: string | null
      prefecture: string | null
      phone_numbers: string[] | null
      fm_record_id: string | null
    }>()

    if (listIds.length > 0) {
      const { data: lrs } = await supabase
        .from('list_records')
        .select('id, company_name, representative_name, prefecture, phone_numbers, fm_record_id')
        .in('id', listIds)
      lrs?.forEach(lr => lrMap.set(lr.id, lr))
    }

    // 電話番号の重複チェック用マップ
    const phoneCount = new Map<string, number>()
    const rawPhones = wls.map(wl => {
      const lr = wl.added_to_list_id ? lrMap.get(wl.added_to_list_id) : undefined
      return (lr?.phone_numbers?.[0]) ?? extractPhone(wl.raw_data)
    })
    rawPhones.forEach(p => {
      if (p && p !== '—') phoneCount.set(p, (phoneCount.get(p) ?? 0) + 1)
    })

    const enriched: WebhookLead[] = wls.map((wl, i) => {
      const lr = wl.added_to_list_id ? lrMap.get(wl.added_to_list_id) : undefined
      const phone = (lr?.phone_numbers?.[0]) ?? extractPhone(wl.raw_data)
      return {
        ...wl,
        company_name:        lr?.company_name ?? extractField(wl.raw_data, 'company_name', '会社名'),
        representative_name: lr?.representative_name ?? extractField(wl.raw_data, 'full_name', '代表名'),
        prefecture:          lr?.prefecture ?? extractField(wl.raw_data, 'state', '都道府県', '県名'),
        phone,
        fm_synced:   !!lr?.fm_record_id,
        is_duplicate: phone !== '—' && (phoneCount.get(phone) ?? 0) > 1,
      }
    })

    setLeads(enriched)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = leads.filter(l => {
    if (tab === 'pending') return l.status === 'pending'
    if (tab === 'added')   return l.status === 'added'
    return true
  })

  const allSelected  = filtered.length > 0 && selected.size === filtered.length
  const someSelected = selected.size > 0

  function toggleAll(checked: boolean) {
    if (checked) setSelected(new Set(filtered.map(l => l.id)))
    else setSelected(new Set())
  }

  function toggleOne(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
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
      setResult(`完了: リード ${json.created}件 / FM新規 ${json.fm_created}件 / FMリンク ${json.fm_linked}件 / エラー ${json.failed}件`)
      await load()
    } finally {
      setPushing(false)
    }
  }

  const tabStyle = (t: Tab) => ({
    padding: '6px 14px',
    fontSize: 12,
    fontWeight: tab === t ? 600 : 400,
    color: tab === t ? 'var(--color-blue)' : 'var(--color-gray-600)',
    borderBottom: tab === t ? '2px solid var(--color-blue)' : '2px solid transparent',
    background: 'none',
    border: 'none',
    borderBottomWidth: 2,
    borderBottomStyle: 'solid' as const,
    borderBottomColor: tab === t ? 'var(--color-blue)' : 'transparent',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  })

  const counts = {
    all:     leads.length,
    pending: leads.filter(l => l.status === 'pending').length,
    added:   leads.filter(l => l.status === 'added').length,
  }

  return (
    <div style={{ padding: '24px 28px', height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ヘッダー */}
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: 2 }}>受信リード</h1>
        <p style={{ fontSize: 12, color: 'var(--color-gray-600)' }}>
          Webフック経由で受信した広告リードの一覧です。チェックしてリスト・FM登録できます。
        </p>
      </div>

      {/* タブ + アクションバー */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--color-gray-200)' }}>
        <div style={{ display: 'flex', gap: 0 }}>
          <button style={tabStyle('all')}     onClick={() => setTab('all')}>全て ({counts.all})</button>
          <button style={tabStyle('pending')} onClick={() => setTab('pending')}>未処理 ({counts.pending})</button>
          <button style={tabStyle('added')}   onClick={() => setTab('added')}>処理済み ({counts.added})</button>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          {someSelected && (
            <span style={{ fontSize: 11, color: 'var(--color-gray-600)' }}>{selected.size}件選択中</span>
          )}
          <button
            onClick={pushSelected}
            disabled={!someSelected || pushing}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: someSelected && !pushing ? 'pointer' : 'not-allowed',
              background: someSelected ? 'var(--color-blue)' : 'var(--color-gray-200)',
              color: someSelected ? '#fff' : 'var(--color-gray-400)',
              opacity: pushing ? 0.6 : 1,
            }}
          >
            {pushing ? '送信中…' : '選択してリスト & FM登録'}
          </button>
          <button
            onClick={load}
            style={{
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 8,
              border: '1px solid var(--color-gray-200)',
              background: '#fff',
              color: 'var(--color-gray-600)',
              cursor: 'pointer',
            }}
          >
            更新
          </button>
        </div>
      </div>

      {result && (
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '8px 12px', borderRadius: 8 }}>
          {result}
        </div>
      )}

      {/* テーブル */}
      <div style={{ flex: 1, overflow: 'auto', borderRadius: 12, border: '1px solid var(--color-gray-200)', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, minWidth: 1000 }}>
          <thead style={{ background: 'var(--color-gray-50)', position: 'sticky', top: 0, zIndex: 1 }}>
            <tr style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
              <th style={{ width: 36, padding: '8px 12px' }}>
                <input type="checkbox" checked={allSelected} onChange={e => toggleAll(e.target.checked)} />
              </th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>受信日時</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>広告名</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>会社名</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>代表名</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>都道府県</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>電話番号</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>ステータス</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>FM同期</th>
              <th className={th} style={{ color: 'var(--color-gray-600)' }}>重複</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={10} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 13 }} className="animate-pulse">
                  読み込み中…
                </td>
              </tr>
            )}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: '48px 0', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 13 }}>
                  リードはありません
                </td>
              </tr>
            )}
            {!loading && filtered.map((lead, idx) => {
              const st = STATUS[lead.status as keyof typeof STATUS] ?? { label: lead.status, bg: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }
              const rowBg = lead.is_duplicate
                ? (selected.has(lead.id) ? '#FEF3C7' : '#FFFBEB')
                : (selected.has(lead.id) ? '#EFF6FF' : idx % 2 === 1 ? '#f9fafb' : '#fff')

              return (
                <tr
                  key={lead.id}
                  onClick={() => setModal(lead)}
                  style={{ borderBottom: '1px solid var(--color-gray-200)', background: rowBg, cursor: 'pointer' }}
                >
                  <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selected.has(lead.id)} onChange={() => toggleOne(lead.id)} />
                  </td>
                  <td className={`${td} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                    {lead.created_at.slice(0, 16).replace('T', ' ')}
                  </td>
                  <td className={td} style={{ color: 'var(--color-gray-700)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lead.ad_name ?? '—'}
                  </td>
                  <td className={td} style={{ color: 'var(--color-gray-900)', fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {lead.company_name ?? '—'}
                  </td>
                  <td className={td} style={{ color: 'var(--color-gray-700)' }}>
                    {lead.representative_name ?? '—'}
                  </td>
                  <td className={td} style={{ color: 'var(--color-gray-600)' }}>
                    {lead.prefecture ?? '—'}
                  </td>
                  <td className={`${td} tabular-nums`} style={{ color: 'var(--color-gray-600)' }}>
                    {lead.phone ?? '—'}
                  </td>
                  <td className={td}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                      background: st.bg, color: st.color,
                    }}>
                      {st.label}
                    </span>
                  </td>
                  <td className={td}>
                    {lead.fm_synced
                      ? <span style={{ fontSize: 11, color: 'var(--color-success)' }}>✓ 同期済み</span>
                      : <span style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>未同期</span>}
                  </td>
                  <td className={td}>
                    {lead.is_duplicate
                      ? <span style={{ fontSize: 11, fontWeight: 600, color: '#D97706' }}>⚠ 重複</span>
                      : <span style={{ fontSize: 11, color: 'var(--color-gray-300)' }}>—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* 詳細モーダル */}
      {modal && (
        <div
          onClick={() => setModal(null)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff', borderRadius: 16, padding: '28px 32px',
              width: '100%', maxWidth: 520, maxHeight: '85vh', overflowY: 'auto',
              boxShadow: '0 20px 60px rgba(0,0,0,.25)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: 3 }}>
                  {modal.company_name ?? '（会社名なし）'}
                </h2>
                <p style={{ fontSize: 11, color: 'var(--color-gray-600)' }}>
                  {modal.created_at.slice(0, 16).replace('T', ' ')} &nbsp;|&nbsp; {modal.ad_name ?? '広告名不明'}
                </p>
              </div>
              <button
                onClick={() => setModal(null)}
                style={{ fontSize: 18, color: 'var(--color-gray-400)', background: 'none', border: 'none', cursor: 'pointer', lineHeight: 1 }}
              >
                ✕
              </button>
            </div>

            {/* ステータス・FM */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {(() => {
                const st = STATUS[modal.status as keyof typeof STATUS] ?? { label: modal.status, bg: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }
                return (
                  <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: st.bg, color: st.color }}>
                    {st.label}
                  </span>
                )
              })()}
              {modal.fm_synced
                ? <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, background: '#DCFCE7', color: '#166534' }}>FM同期済み</span>
                : <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, background: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }}>FM未同期</span>
              }
              {modal.is_duplicate && (
                <span style={{ padding: '3px 10px', borderRadius: 4, fontSize: 11, background: '#FEF3C7', color: '#D97706' }}>⚠ 重複電話番号</span>
              )}
            </div>

            {/* フォーム回答フィールド */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                フォーム回答
              </p>
              {getFieldData(modal.raw_data).length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {getFieldData(modal.raw_data).map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontSize: 11, color: 'var(--color-gray-600)', width: 140, flexShrink: 0, paddingTop: 1 }}>
                        {f.name}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--color-gray-900)', fontWeight: 500 }}>
                        {f.values?.join(', ') || '—'}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--color-gray-400)' }}>フィールドデータなし</p>
              )}
            </div>

            {/* その他情報 */}
            <div style={{ borderTop: '1px solid var(--color-gray-200)', paddingTop: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                メタ情報
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  ['ID',      modal.id],
                  ['ソース', modal.source ?? '—'],
                  ['広告名', modal.ad_name ?? '—'],
                  ['マッチ', modal.match_status ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', gap: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--color-gray-600)', width: 60, flexShrink: 0 }}>{k}</span>
                    <span style={{ fontSize: 11, color: 'var(--color-gray-700)', wordBreak: 'break-all' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
