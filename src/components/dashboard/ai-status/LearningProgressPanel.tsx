const metrics = [
  { label: '文字起こし済み音声', value: '—', unit: '件' },
  { label: 'ベクトル化済みデータ', value: '—', unit: '件' },
  { label: 'パターン検出数', value: '—', unit: '件' },
  { label: '直近の学習精度', value: '—', unit: '' },
]

export function LearningProgressPanel() {
  return (
    <div
      className="rounded-xl p-6"
      style={{ border: '1px solid var(--color-gray-200)', backgroundColor: 'var(--color-white)' }}
    >
      <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-gray-900)' }}>
        学習進捗
      </h2>
      <div className="grid grid-cols-2 gap-4">
        {metrics.map((m) => (
          <div key={m.label} className="flex flex-col gap-1">
            <span className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>
              {m.label}
            </span>
            <span
              className="text-[18px] font-semibold tabular-nums"
              style={{ color: 'var(--color-gray-900)' }}
            >
              {m.value}
              {m.unit && (
                <span className="text-[12px] font-normal ml-1" style={{ color: 'var(--color-gray-400)' }}>
                  {m.unit}
                </span>
              )}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-gray-100)' }}>
        <p className="text-[12px]" style={{ color: 'var(--color-gray-400)' }}>
          Supabase接続後に学習データが蓄積されます
        </p>
      </div>
    </div>
  )
}
