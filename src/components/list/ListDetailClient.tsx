'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ActionSidebar } from './ActionSidebar'
import { ListAttrHeader } from './ListAttrHeader'
import { ListMainDetail } from './ListMainDetail'
import { HistoryTabs } from './HistoryTabs'
import { InquiryHistory } from './InquiryHistory'
import { MemoArea } from './MemoArea'

type Call = {
  id: string
  call_date: string | null
  call_start_time: string | null
  call_end_time: string | null
  call_duration_minutes: number | null
  agent_name: string | null
  call_result: string | null
  call_category: string | null
  appo_detail: string | null
}

type Lead = {
  id: string
  inquiry_date: string | null
  ad_name: string | null
  last_call_result: string | null
  order_closed: boolean | null
  jitsuyo_ok: boolean | null
  total_revenue: number | null
}

type SyncStatus = 'idle' | 'saving' | 'fm_pending' | 'error' | 'done'
type PresencePayload = { sessionId: string; name: string }
type EditableFields = { case_memo: string; recall_date: string; recall_time: string }

function SyncBanner({
  status,
  error,
  onRetry,
}: {
  status: SyncStatus
  error: string | null
  onRetry: () => void
}) {
  if (status === 'idle') return null

  const configs: Partial<Record<SyncStatus, { bg: string; color: string; msg: string }>> = {
    saving:     { bg: 'var(--color-blue-light)',  color: 'var(--color-blue)',    msg: '保存中...' },
    fm_pending: { bg: 'var(--color-warning-bg)',  color: 'var(--color-warning)', msg: 'Web保存済 / FM同期中...' },
    error:      { bg: 'var(--color-danger-bg)',   color: 'var(--color-danger)',  msg: `FM同期未完了（再試行中）${error ? ': ' + error : ''}` },
    done:       { bg: 'var(--color-success-bg)',  color: 'var(--color-success)', msg: '同期完了' },
  }
  const c = configs[status]
  if (!c) return null

  return (
    <div
      className="flex items-center justify-between px-3 py-1 text-[11px] shrink-0 border-b"
      style={{ background: c.bg, color: c.color, borderColor: 'var(--color-gray-200)' }}
    >
      <span>{c.msg}</span>
      {status === 'error' && (
        <button onClick={onRetry} className="text-[10px] underline ml-4">
          再試行
        </button>
      )}
    </div>
  )
}

export function ListDetailClient({
  record,
  calls,
  leads,
}: {
  record: Record<string, unknown>
  calls: Call[]
  leads: Lead[]
}) {
  const listRecordId = record.id as string
  const fmRecordId   = record.fm_record_id as string | null

  const [fields, setFields] = useState<EditableFields>({
    case_memo:   (record.case_memo   as string) ?? '',
    recall_date: (record.recall_date as string) ?? '',
    recall_time: (record.recall_time as string) ?? '',
  })
  const initialFields = useRef<EditableFields>(fields)

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError,  setSyncError]  = useState<string | null>(null)
  const [otherUsers, setOtherUsers] = useState<PresencePayload[]>([])
  const mySessionId = useRef(crypto.randomUUID())

  // Supabase Realtime Presence — 排他制御
  useEffect(() => {
    const supabase  = createClient()
    const sessionId = mySessionId.current
    const name = 'ユーザー' + sessionId.slice(-4)

    const channel = supabase.channel(`list-detail:${listRecordId}`)

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresencePayload>()
        const all   = Object.values(state).flat()
        setOtherUsers(all.filter((p) => p.sessionId !== sessionId))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ sessionId, name })
        }
      })

    return () => {
      channel.untrack()
      supabase.removeChannel(channel)
    }
  }, [listRecordId])

  const isLocked = otherUsers.length > 0
  const lockedBy = otherUsers[0]?.name ?? null

  // 終了ボタン → 差分保存 → FM 非同期同期
  const doSave = useCallback(async () => {
    const diff: Partial<EditableFields> = {}
    const init = initialFields.current
    if (fields.case_memo   !== init.case_memo)   diff.case_memo   = fields.case_memo
    if (fields.recall_date !== init.recall_date) diff.recall_date = fields.recall_date
    if (fields.recall_time !== init.recall_time) diff.recall_time = fields.recall_time

    if (Object.keys(diff).length === 0) return

    setSyncStatus('saving')
    setSyncError(null)

    try {
      const res = await fetch(`/api/list-records/${listRecordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: diff, fmRecordId }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `status ${res.status}`)
      }

      initialFields.current = { ...fields }
      setSyncStatus('fm_pending')
      setTimeout(() => setSyncStatus('done'), 3000)
      setTimeout(() => setSyncStatus('idle'), 6000)
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : String(err))
      setSyncStatus('error')
    }
  }, [fields, listRecordId, fmRecordId])

  return (
    <div
      className="-m-8 flex overflow-hidden"
      style={{ height: 'calc(100vh - 56px)', background: 'var(--color-gray-50)' }}
    >
      <ActionSidebar onEnd={doSave} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <SyncBanner status={syncStatus} error={syncError} onRetry={doSave} />
        <ListAttrHeader record={record} />
        <ListMainDetail
          record={record}
          recallDate={fields.recall_date}
          recallTime={fields.recall_time}
          onRecallDateChange={(v) => setFields((f) => ({ ...f, recall_date: v }))}
          onRecallTimeChange={(v) => setFields((f) => ({ ...f, recall_time: v }))}
          disabled={isLocked}
        />

        <div className="flex flex-1 gap-2 p-2 overflow-hidden min-h-0">
          <HistoryTabs calls={calls} leads={leads} />

          <div
            className="flex flex-col gap-2 min-h-0 overflow-hidden"
            style={{ width: '34%', flexShrink: 0 }}
          >
            <InquiryHistory leads={leads} />
            <MemoArea
              memo={fields.case_memo}
              onChange={(v) => setFields((f) => ({ ...f, case_memo: v }))}
              disabled={isLocked}
              presenceName={lockedBy}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
