'use client'

import { StatusSelect } from './StatusSelect'
import { AppoStatusSelect } from '@/components/shared/AppoStatusSelect'

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

export function ListAttrHeader({
  record,
  listRecordId,
  statusLead,
  appoDetailStatus,
  onStatusChange,
  onAppoDetailChange,
}: {
  record: Rec
  listRecordId: string
  statusLead?: { id: string; status: string } | null
  appoDetailStatus?: string | null
  onStatusChange?: (s: string) => void
  onAppoDetailChange?: (detail: string | null) => void
}) {
  const listCreatedAt = (record.list_created_at as string | null)
    ?.slice(0, 16)
    .replace('T', ' ')

  const statusValue = statusLead?.status ?? ''

  return (
    <div
      className="flex items-center gap-6 px-4 py-2 shrink-0 border-b overflow-x-auto"
      style={{ background: 'var(--color-white)', borderColor: 'var(--color-gray-200)' }}
    >
      <AttrCell label="顧客ID" value={record.customer_id as string} />
      {record.ad_name ? (
        <div className="flex flex-col gap-0.5 shrink-0">
          <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-gray-400)' }}>
            広告名
          </span>
          <span
            className="text-[11px] font-semibold tabular-nums"
            style={{
              color: 'var(--color-white)',
              background: 'var(--color-blue)',
              padding: '2px 8px',
              borderRadius: 9999,
              display: 'inline-block',
              maxWidth: 200,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={record.ad_name as string}
          >
            {record.ad_name as string}
          </span>
        </div>
      ) : null}
      <AttrCell label="リスト譲渡日" value={record.list_handover_date as string} />
      <AttrCell label="リスト" value={record.list_name as string} />
      <AttrCell label="業種" value={record.industry as string} />
      <div className="flex flex-col gap-0.5 shrink-0">
        <span className="text-[9px] font-medium uppercase tracking-wide" style={{ color: 'var(--color-gray-400)' }}>
          ステータス
        </span>
        {statusLead ? (
          <div className="flex items-center gap-2 flex-wrap">
            <StatusSelect
              leadId={statusLead.id}
              value={statusValue}
              size="sm"
              onUpdate={onStatusChange}
            />
            <AppoStatusSelect
              leadId={statusLead.id}
              listRecordId={listRecordId}
              currentStatus={statusValue}
              currentDetail={appoDetailStatus ?? null}
              size="sm"
              onUpdate={onAppoDetailChange}
            />
          </div>
        ) : (
          <span className="text-[11px]" style={{ color: 'var(--color-gray-300)' }}>—</span>
        )}
      </div>
      <AttrCell label="リスト作成日時" value={listCreatedAt} />
    </div>
  )
}
