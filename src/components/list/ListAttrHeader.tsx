type Rec = Record<string, unknown>

function AttrCell({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5 shrink-0">
      <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-gray-400)' }}>
        {label}
      </span>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: 'var(--color-gray-900)' }}>
        {value || '—'}
      </span>
    </div>
  )
}

export function ListAttrHeader({ record }: { record: Rec }) {
  const listCreatedAt = (record.list_created_at as string | null)
    ?.slice(0, 16)
    .replace('T', ' ')

  return (
    <div
      className="flex items-center gap-6 px-4 py-2 shrink-0 border-b overflow-x-auto"
      style={{ background: 'var(--color-gray-100)', borderColor: 'var(--color-gray-200)' }}
    >
      <AttrCell label="顧客ID" value={record.customer_id as string} />
      <AttrCell label="リスト譲渡日" value={record.list_handover_date as string} />
      <AttrCell label="リスト" value={record.list_name as string} />
      <AttrCell label="業種" value={record.industry as string} />
      <AttrCell label="新人フラグ" value={record.newcomer_flag as string} />
      <AttrCell label="リスト作成日時" value={listCreatedAt} />
    </div>
  )
}
