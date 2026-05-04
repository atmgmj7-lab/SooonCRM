'use client'

import { useState } from 'react'

type Call = {
  id: string
  call_date: string | null
  call_start_time: string | null
  call_end_time: string | null
  call_duration_minutes: number | null
  agent_name: string | null
  call_result: string | null
  call_category: string | null
  appo_detail: string | null
}

type Lead = {
  id: string
  inquiry_date: string | null
  ad_name: string | null
  last_call_result: string | null
  order_closed: boolean | null
  jitsuyo_ok: boolean | null
  total_revenue: number | null
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result) return null
  let bg = 'var(--color-gray-100)'
  let color = 'var(--color-gray-600)'
  if (result.includes('アポ')) { bg = 'var(--color-success-bg)'; color = 'var(--color-success)' }
  else if (result.includes('留守')) { bg = 'var(--color-warning-bg)'; color = 'var(--color-warning)' }
  else if (result.includes('NG') || result.includes('断') || result.includes('拒')) {
    bg = 'var(--color-danger-bg)'; color = 'var(--color-danger)'
  }
  return (
    <span
      className="px-1 py-0.5 rounded text-[9px] font-medium whitespace-nowrap"
      style={{ background: bg, color }}
    >
      {result}
    </span>
  )
}

export function HistoryTabs({ calls, leads }: { calls: Call[]; leads: Lead[] }) {
  const [tab, setTab] = useState<'calls' | 'leads'>('calls')

  return (
    <div
      className="flex flex-col border rounded-lg overflow-hidden flex-1 min-h-0"
      style={{ background: 'var(--color-white)', borderColor: 'var(--color-gray-200)' }}
    >
      <div
        className="flex shrink-0 border-b"
        style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-gray-50)' }}
      >
        {(['calls', 'leads'] as const).map((key) => {
          const label = key === 'calls'
            ? `コール履歴 (${calls.length})`
            : `リード履歴 (${leads.length})`
          const active = tab === key
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className="px-4 py-1.5 text-[11px] font-medium border-b-2 transition-colors"
              style={{
                borderColor: active ? 'var(--color-blue)' : 'transparent',
                color: active ? 'var(--color-blue)' : 'var(--color-gray-400)',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        {tab === 'calls' ? (
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--color-gray-100)' }}>
              <tr>
                {['架電日', '開始', '終了', '担当者', '結果', 'カテゴリ', 'アポ詳細', '分'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-2 py-1 font-medium whitespace-nowrap border-b"
                    style={{ color: 'var(--color-gray-500)', borderColor: 'var(--color-gray-200)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {calls.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-6 text-center" style={{ color: 'var(--color-gray-400)' }}>
                    コール履歴なし
                  </td>
                </tr>
              ) : calls.map((c, i) => (
                <tr
                  key={c.id}
                  className="border-b hover:bg-gray-50"
                  style={{
                    borderColor: 'var(--color-gray-100)',
                    background: i % 2 === 1 ? 'var(--color-gray-50)' : undefined,
                  }}
                >
                  <td className="px-2 py-0.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--color-gray-800)' }}>{c.call_date ?? ''}</td>
                  <td className="px-2 py-0.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--color-gray-500)' }}>{c.call_start_time ?? ''}</td>
                  <td className="px-2 py-0.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--color-gray-500)' }}>{c.call_end_time ?? ''}</td>
                  <td className="px-2 py-0.5 whitespace-nowrap" style={{ color: 'var(--color-gray-800)' }}>{c.agent_name ?? ''}</td>
                  <td className="px-2 py-0.5"><ResultBadge result={c.call_result} /></td>
                  <td className="px-2 py-0.5 whitespace-nowrap" style={{ color: 'var(--color-gray-500)' }}>{c.call_category ?? ''}</td>
                  <td className="px-2 py-0.5 max-w-[180px] truncate" style={{ color: 'var(--color-gray-500)' }} title={c.appo_detail ?? ''}>{c.appo_detail ?? ''}</td>
                  <td className="px-2 py-0.5 tabular-nums text-right whitespace-nowrap" style={{ color: 'var(--color-gray-400)' }}>
                    {c.call_duration_minutes != null ? c.call_duration_minutes.toFixed(1) : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--color-gray-100)' }}>
              <tr>
                {['問い合わせ日', '広告名', '架電結果', '受注', '実用OK', '売上'].map((h) => (
                  <th
                    key={h}
                    className="text-left px-2 py-1 font-medium whitespace-nowrap border-b"
                    style={{ color: 'var(--color-gray-500)', borderColor: 'var(--color-gray-200)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-2 py-6 text-center" style={{ color: 'var(--color-gray-400)' }}>
                    リード履歴なし
                  </td>
                </tr>
              ) : leads.map((l, i) => (
                <tr
                  key={l.id}
                  className="border-b hover:bg-gray-50"
                  style={{
                    borderColor: 'var(--color-gray-100)',
                    background: i % 2 === 1 ? 'var(--color-gray-50)' : undefined,
                  }}
                >
                  <td className="px-2 py-0.5 tabular-nums whitespace-nowrap" style={{ color: 'var(--color-gray-800)' }}>{l.inquiry_date ?? ''}</td>
                  <td className="px-2 py-0.5 max-w-[200px] truncate" style={{ color: 'var(--color-gray-800)' }} title={l.ad_name ?? ''}>{l.ad_name ?? ''}</td>
                  <td className="px-2 py-0.5 whitespace-nowrap" style={{ color: 'var(--color-gray-500)' }}>{l.last_call_result ?? ''}</td>
                  <td className="px-2 py-0.5">
                    {l.order_closed && (
                      <span className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>受注</span>
                    )}
                  </td>
                  <td className="px-2 py-0.5">
                    {l.jitsuyo_ok && (
                      <span className="px-1 py-0.5 rounded text-[9px] font-medium" style={{ background: 'var(--color-blue-light)', color: 'var(--color-blue)' }}>OK</span>
                    )}
                  </td>
                  <td className="px-2 py-0.5 tabular-nums text-right whitespace-nowrap" style={{ color: 'var(--color-gray-500)' }}>
                    {l.total_revenue != null ? `¥${l.total_revenue.toLocaleString()}` : ''}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
