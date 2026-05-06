'use client'

import { useState } from 'react'
import type { ChangeEvent } from 'react'

// DBに実際に存在するステータス値のみ定義（CLI.md デザイン変数に合わせた色）
export const CALL_RESULT_OPTIONS = [
  { value: 'アポOK', label: 'アポOK', group: '完了' as const, colorVar: '--color-success' },
  { value: 'NG', label: 'NG', group: '完了' as const, colorVar: '--color-danger' },
  { value: '対象外', label: '対象外', group: '完了' as const, colorVar: '--color-gray-400' },
  { value: 'ポータルサイト', label: 'ポータルサイト', group: '完了' as const, colorVar: '--color-gray-400' },
  { value: '現アナ', label: '現アナ', group: '完了' as const, colorVar: '--color-gray-400' },
  { value: '重複', label: '重複', group: '完了' as const, colorVar: '--color-gray-400' },
  { value: '改め', label: '改め', group: '完了' as const, colorVar: '--color-gray-400' },
  { value: '未対応', label: '未対応', group: '完了' as const, colorVar: '--color-gray-400' },
  { value: '新規', label: '新規', group: '未完了' as const, colorVar: '--color-gray-600' },
  { value: '留守', label: '留守', group: '未完了' as const, colorVar: '--color-warning' },
  { value: '見込みA', label: '見込みA', group: '未完了' as const, colorVar: '--color-blue' },
  { value: '見込みB', label: '見込みB', group: '未完了' as const, colorVar: '--color-blue' },
  { value: '見込みC', label: '見込みC', group: '未完了' as const, colorVar: '--color-blue' },
] as const

export type CallResultStatus = (typeof CALL_RESULT_OPTIONS)[number]['value']

interface Props {
  value: string
  leadId: string
  size?: 'sm' | 'md'
  onUpdate?: (newStatus: string) => void
}

export function StatusSelect({ value, leadId, size = 'md', onUpdate }: Props) {
  const [saving, setSaving] = useState(false)
  const current = CALL_RESULT_OPTIONS.find((o) => o.value === value)
  const borderColor = current ? `var(${current.colorVar})` : 'var(--color-gray-200)'
  const textColor = current ? `var(${current.colorVar})` : 'var(--color-gray-700)'


  const unknownOption =
    value && !CALL_RESULT_OPTIONS.some((o) => o.value === value) ? (
      <option value={value}>{value}</option>
    ) : null

  const handleChange = async (e: ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value
    setSaving(true)
    try {
      const res = await fetch(`/api/leads/${leadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('更新失敗')
      onUpdate?.(newStatus)
    } catch {
      alert('ステータス更新に失敗しました')
    } finally {
      setSaving(false)
    }
  }

  return (
    <select
      value={value}
      onChange={handleChange}
      disabled={saving}
      className="tabular-nums"
      style={{
        padding: size === 'sm' ? '2px 6px' : '4px 8px',
        borderRadius: 8,
        border: `2px solid ${borderColor}`,
        background: 'var(--color-white)',
        color: textColor,
        fontWeight: 600,
        fontSize: size === 'sm' ? 11 : 12,
        cursor: saving ? 'wait' : 'pointer',
        opacity: saving ? 0.7 : 1,
      }}
    >
      {unknownOption}
      <optgroup label="完了">
        {CALL_RESULT_OPTIONS.filter((o) => o.group === '完了').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </optgroup>
      <optgroup label="未完了">
        {CALL_RESULT_OPTIONS.filter((o) => o.group === '未完了').map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </optgroup>
    </select>
  )
}
