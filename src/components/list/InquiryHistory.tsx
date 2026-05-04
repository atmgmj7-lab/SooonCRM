type Lead = {
  id: string
  inquiry_date: string | null
  ad_name: string | null
  last_call_result: string | null
  order_closed: boolean | null
}

export function InquiryHistory({ leads }: { leads: Lead[] }) {
  return (
    <div
      className="shrink-0 flex flex-col border rounded-lg overflow-hidden"
      style={{
        height: '150px',
        background: 'var(--color-white)',
        borderColor: 'var(--color-gray-200)',
      }}
    >
      <div
        className="px-3 py-1 shrink-0 border-b flex items-center justify-between"
        style={{ background: 'var(--color-gray-50)', borderColor: 'var(--color-gray-200)' }}
      >
        <span className="text-[10px] font-semibold" style={{ color: 'var(--color-gray-600)' }}>
          お問い合わせ履歴
        </span>
        <span className="text-[9px] tabular-nums" style={{ color: 'var(--color-gray-400)' }}>
          {leads.length}件
        </span>
      </div>

      <div className="overflow-y-auto flex-1 min-h-0">
        {leads.length === 0 ? (
          <div className="px-3 py-4 text-[10px] text-center" style={{ color: 'var(--color-gray-400)' }}>
            履歴なし
          </div>
        ) : (
          <table className="w-full text-[10px] border-collapse">
            <tbody>
              {leads.map((l, i) => (
                <tr
                  key={l.id}
                  className="border-b"
                  style={{
                    borderColor: 'var(--color-gray-100)',
                    background: i % 2 === 1 ? 'var(--color-gray-50)' : undefined,
                  }}
                >
                  <td
                    className="px-2 py-0.5 tabular-nums whitespace-nowrap"
                    style={{ color: 'var(--color-gray-500)', width: '80px' }}
                  >
                    {l.inquiry_date ?? '—'}
                  </td>
                  <td
                    className="px-2 py-0.5 max-w-[140px] truncate"
                    style={{ color: 'var(--color-gray-800)' }}
                    title={l.ad_name ?? ''}
                  >
                    {l.ad_name ?? '—'}
                  </td>
                  <td className="px-2 py-0.5 whitespace-nowrap" style={{ width: '60px' }}>
                    {l.last_call_result ? (
                      <span
                        className="px-1 py-0.5 rounded text-[9px] font-medium"
                        style={{
                          background: l.order_closed
                            ? 'var(--color-success-bg)'
                            : 'var(--color-gray-100)',
                          color: l.order_closed
                            ? 'var(--color-success)'
                            : 'var(--color-gray-500)',
                        }}
                      >
                        {l.last_call_result}
                      </span>
                    ) : null}
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
