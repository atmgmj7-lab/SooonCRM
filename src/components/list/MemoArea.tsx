'use client'

export function MemoArea({
  memo,
  onChange,
  disabled,
  presenceName,
}: {
  memo: string
  onChange?: (v: string) => void
  disabled?: boolean
  presenceName?: string | null
}) {
  return (
    <div
      className="relative flex flex-col border rounded-lg overflow-hidden flex-1 min-h-0"
      style={{
        background: 'var(--color-white)',
        borderColor: disabled ? 'var(--color-warning)' : 'var(--color-gray-200)',
      }}
    >
      <div
        className="px-3 py-1.5 shrink-0 border-b flex items-center justify-between"
        style={{ background: 'var(--color-gray-50)', borderColor: 'var(--color-gray-200)' }}
      >
        <span className="text-[10px] font-semibold" style={{ color: 'var(--color-gray-600)' }}>
          メモ
        </span>
        {presenceName && (
          <span
            className="text-[9px] px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
          >
            {presenceName}さんが編集中
          </span>
        )}
      </div>
      <textarea
        value={memo}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        placeholder="メモを入力..."
        className="flex-1 w-full px-3 py-2 text-[11px] resize-none outline-none"
        style={{
          color: 'var(--color-gray-900)',
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.7 : 1,
        }}
      />
    </div>
  )
}
