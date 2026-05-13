'use client'

import { useEffect, useMemo, useRef, useState } from 'react'

export interface ColumnFilterProps {
  label: string
  values: string[]
  selected: string[]
  onChange: (selected: string[]) => void
  loading?: boolean
}

const MAX_VALUES = 200

function uniquePreserveOrder(items: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const v of items) {
    if (seen.has(v)) continue
    seen.add(v)
    out.push(v)
  }
  return out
}

export function ColumnFilter({
  label,
  values,
  selected,
  onChange,
  loading = false,
}: ColumnFilterProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const displayValues = useMemo(
    () => uniquePreserveOrder(values).slice(0, MAX_VALUES),
    [values],
  )

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent) => {
      const el = rootRef.current
      if (!el || el.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  const selectedSet = useMemo(() => new Set(selected), [selected])
  const selectedCount = selected.length

  const toggleValue = (v: string) => {
    if (selectedSet.has(v)) {
      onChange(selected.filter((x) => x !== v))
    } else {
      onChange([...selected, v])
    }
  }

  const selectAll = () => {
    onChange([...displayValues])
  }

  const clearAll = () => {
    onChange([])
  }

  return (
    <div ref={rootRef} className="relative inline-flex items-center">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={loading}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex max-w-full items-center gap-1 rounded-lg px-0 py-1 text-[12px] font-medium transition-colors duration-150"
        style={{
          color: 'var(--color-navy)',
          background: open ? 'var(--color-gray-100)' : 'transparent',
          cursor: loading ? 'wait' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        <span className="truncate">
          {label}
          {selectedCount > 0 ? (
            <span
              className="tabular-nums"
              style={{ color: 'var(--color-gray-600)' }}
            >
              {' '}
              ({selectedCount})
            </span>
          ) : null}
        </span>
        <span
          className="shrink-0 text-[11px] leading-none"
          style={{ color: 'var(--color-gray-500)' }}
          aria-hidden
        >
          ▼
        </span>
      </button>

      {open ? (
        <div
          className="absolute left-0 top-full z-50 mt-2 min-w-48 overflow-hidden rounded-lg shadow-md"
          style={{
            border: '1px solid var(--color-gray-200)',
            background: 'var(--color-white)',
          }}
          role="listbox"
          aria-multiselectable
        >
          <div
            className="flex items-center gap-2 border-b p-3"
            style={{ borderColor: 'var(--color-gray-200)' }}
          >
            <button
              type="button"
              onClick={selectAll}
              disabled={loading || displayValues.length === 0}
              className="text-[12px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: 'var(--color-blue)' }}
            >
              全選択
            </button>
            <span style={{ color: 'var(--color-gray-300)' }} aria-hidden>
              |
            </span>
            <button
              type="button"
              onClick={clearAll}
              disabled={loading || selectedCount === 0}
              className="text-[12px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: 'var(--color-gray-600)' }}
            >
              全解除
            </button>
          </div>

          <div
            className="max-h-64 overflow-y-auto p-3"
            style={
              loading
                ? {
                    minHeight: 48,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }
                : undefined
            }
          >
            {loading ? (
              <span className="text-[12px]" style={{ color: 'var(--color-gray-600)' }}>
                読み込み中…
              </span>
            ) : displayValues.length === 0 ? (
              <span className="text-[12px]" style={{ color: 'var(--color-gray-500)' }}>
                候補がありません
              </span>
            ) : (
              <ul className="flex flex-col gap-2">
                {displayValues.map((v) => {
                  const checked = selectedSet.has(v)
                  return (
                    <li key={v}>
                      <label
                        className="flex cursor-pointer items-start gap-2 text-[12px] transition-colors duration-150"
                        style={{ color: 'var(--color-gray-900)' }}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleValue(v)}
                          className="mt-1 h-4 w-4 shrink-0 rounded border align-top accent-[var(--color-blue)]"
                          style={{ borderColor: 'var(--color-gray-300)' }}
                        />
                        <span className="min-w-0 break-words">{v}</span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  )
}
