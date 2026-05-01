const columns = ['媒体', '広告費', 'リード数', 'CPL', '受注数', 'ROI']

export function AdRoiPanel() {
  return (
    <div
      className="rounded-xl p-6"
      style={{ border: '1px solid var(--color-gray-200)', backgroundColor: 'var(--color-white)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[14px] font-semibold" style={{ color: 'var(--color-gray-900)' }}>
          広告ROI概要
        </h2>
        <span className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>
          当月
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[12px]">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-gray-100)' }}>
              {columns.map((col) => (
                <th
                  key={col}
                  className="text-left pb-2 font-medium"
                  style={{ color: 'var(--color-gray-400)' }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              {columns.map((col) => (
                <td
                  key={col}
                  className="py-3 tabular-nums"
                  style={{ color: 'var(--color-gray-400)' }}
                >
                  —
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="text-[11px] mt-3" style={{ color: 'var(--color-gray-400)' }}>
        広告データ連携後に表示されます
      </p>
    </div>
  )
}
