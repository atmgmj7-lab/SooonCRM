'use client'

import { useState } from 'react'

export const APPO_DETAIL_OPTIONS = [
  { value: '調整中', label: '調整中', colorVar: '--color-warning', bgVar: '--color-warning-bg' },
  { value: '採用OK', label: '採用OK', colorVar: '--color-blue', bgVar: '--color-blue-light' },
  { value: '採用NG', label: '採用NG', colorVar: '--color-danger', bgVar: '--color-danger-bg' },
  { value: '受注', label: '受注', colorVar: '--color-success', bgVar: '--color-success-bg' },
] as const

interface Props {
  leadId?: string
  listRecordId?: string
  /** leads.status または last_call_result / call_result */
  currentStatus: string | null
  currentDetail: string | null
  onUpdate?: (detail: string | null) => void
  size?: 'sm' | 'md'
}

export function AppoStatusSelect({
  leadId,
  listRecordId,
  currentStatus,
  currentDetail,
  onUpdate,
  size = 'md',
}: Props) {
  const [saving, setSaving] = useState(false)
  const isAppo = currentStatus === 'アポOK'

  if (!isAppo) return null

  const current = APPO_DETAIL_OPTIONS.find((o) => o.value === currentDetail)

  const handleChange = async (value: string) => {
    const nextDetail = value === '' ? null : value
    setSaving(true)
    try {
      if (leadId) {
        const res = await fetch(`/api/leads/${leadId}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'アポOK',
            appo_detail_status: nextDetail,
          }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `更新失敗 (${res.status})`)
        }
      } else if (listRecordId) {
        const res = await fetch(`/api/list-records/${listRecordId}/appo-detail`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appo_detail_status: nextDetail }),
        })
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string }
          throw new Error(body.error ?? `更新失敗 (${res.status})`)
        }
      } else {
        throw new Error('leadId または listRecordId が必要です')
      }
      onUpdate?.(nextDetail)
    } catch (e) {
      const msg = e instanceof Error ? e.message : '更新に失敗しました'
      alert(msg)
    } finally {
      setSaving(false)
    }
  }

  const fs = size === 'sm' ? 10 : 11

  return (
    <div className="flex items-center gap-1 shrink-0">
      {current && (
        <span
          className="rounded-[10px] font-semibold whitespace-nowrap tabular-nums"
          style={{
            padding: size === 'sm' ? '1px 6px' : '2px 8px',
            fontSize: fs,
            background: `var(${current.bgVar})`,
            color: `var(${current.colorVar})`,
          }}
        >
          {current.label}
        </span>
      )}

      <select
        value={currentDetail ?? ''}
        onChange={(e) => void handleChange(e.target.value)}
        disabled={saving}
        className="tabular-nums"
        style={{
          fontSize: fs,
          border: '1px solid var(--color-gray-200)',
          borderRadius: 8,
          padding: size === 'sm' ? '1px 4px' : '2px 6px',
          background: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          cursor: saving ? 'wait' : 'pointer',
          opacity: saving ? 0.75 : 1,
        }}
      >
        <option value="">内訳を選択</option>
        {APPO_DETAIL_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
