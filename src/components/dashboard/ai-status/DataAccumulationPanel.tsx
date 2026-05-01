export function DataAccumulationPanel() {
  return (
    <div
      className="rounded-xl p-6"
      style={{ border: '1px solid var(--color-gray-200)', backgroundColor: 'var(--color-white)' }}
    >
      <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-gray-900)' }}>
        データ蓄積状況
      </h2>
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '総リード数', value: '—', sub: '今月: —' },
          { label: '総コール数', value: '—', sub: '今月: —' },
          { label: '受注数', value: '—', sub: '今月: —' },
        ].map((item) => (
          <div key={item.label} className="flex flex-col gap-1">
            <span className="text-[12px]" style={{ color: 'var(--color-gray-400)' }}>{item.label}</span>
            <span className="text-[22px] font-semibold tabular-nums" style={{ color: 'var(--color-gray-900)' }}>
              {item.value}
            </span>
            <span className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>{item.sub}</span>
          </div>
        ))}
      </div>
      <div>
        <div className="flex justify-between text-[12px] mb-2" style={{ color: 'var(--color-gray-600)' }}>
          <span>AI精度向上まで</span>
          <span className="tabular-nums">— / 1,000 件</span>
        </div>
        <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-gray-100)' }}>
          <div className="h-full rounded-full" style={{ width: '0%', backgroundColor: 'var(--color-blue)' }} />
        </div>
      </div>
    </div>
  )
}
