'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  newcomer_flag: string | null
  call_result: string | null
  call_category: string | null
  appo_detail: string | null
  lead_id: string | null
}

type Lead = {
  id: string
  inquiry_date: string | null
  inquiry_at: string | null
  ad_name: string | null
  status: string | null
  newcomer_flag: string | null
  last_call_result: string | null
  order_closed: boolean | null
  jitsuyo_ok: boolean | null
  total_revenue: number | null
  // アポOK内訳（追加）
  appo_detail_status?: string | null
  appo_date?: string | null
  appo_time?: string | null
  appo_detail?: string | null
  source_data?: Record<string, unknown> | null
}

type SyncStatus = 'idle' | 'saving' | 'error' | 'done'
type PresencePayload = { sessionId: string; name: string }

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
    saving: { bg: 'var(--color-blue-light)',  color: 'var(--color-blue)',    msg: '保存中...' },
    error:  { bg: 'var(--color-danger-bg)',   color: 'var(--color-danger)',  msg: `保存失敗${error ? ': ' + error : ''}` },
    done:   { bg: 'var(--color-success-bg)',  color: 'var(--color-success)', msg: '保存完了' },
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
        <button type="button" onClick={onRetry} className="text-[10px] underline ml-4">再試行</button>
      )}
    </div>
  )
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [onClose])
  return (
    <div
      className="fixed bottom-4 right-4 z-50 px-4 py-2 rounded-lg text-[12px] shadow-lg"
      style={{ background: 'var(--color-danger)', color: 'var(--color-white)' }}
    >
      {message}
    </div>
  )
}

export function ListDetailClient({
  record: initialRecord,
  calls,
  leads,
}: {
  record: Record<string, unknown>
  calls: Call[]
  leads: Lead[]
}) {
  const listRecordId = initialRecord.id as string
  const fmRecordId   = initialRecord.fm_record_id as string | null

  const [record, setRecord] = useState<Record<string, unknown>>(initialRecord)
  const [leadsLocal, setLeadsLocal] = useState<Lead[]>(leads)
  const [selectedLeadId, setSelectedLeadId] = useState<string>(
    () => (initialRecord.selected_lead_id as string | null | undefined) ?? '',
  )
  const [memo, setMemo] = useState<string>((initialRecord.case_memo as string) ?? '')
  const memoRef = useRef(memo)
  memoRef.current = memo

  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle')
  const [syncError,  setSyncError]  = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [otherUsers, setOtherUsers] = useState<PresencePayload[]>([])
  const mySessionId = useRef(crypto.randomUUID())

  useEffect(() => { setLeadsLocal(leads) }, [leads])

  useEffect(() => {
    const sid = (initialRecord.selected_lead_id as string | null | undefined) ?? ''
    setSelectedLeadId(sid)
  }, [initialRecord.selected_lead_id])

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
        if (status === 'SUBSCRIBED') await channel.track({ sessionId, name })
      })
    return () => { channel.untrack(); supabase.removeChannel(channel) }
  }, [listRecordId])

  const isLocked = otherUsers.length > 0
  const lockedBy = otherUsers[0]?.name ?? null

  const primaryLead = useMemo(() => {
    if (selectedLeadId) {
      const hit = leadsLocal.find((l) => l.id === selectedLeadId)
      if (hit) return hit
    }
    return leadsLocal[0] ?? null
  }, [leadsLocal, selectedLeadId])

  const saveField = useCallback(async (key: string, value: unknown) => {
    setSyncStatus('saving')
    setSyncError(null)
    try {
      const res = await fetch(`/api/list-records/${listRecordId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { [key]: value }, fmRecordId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `status ${res.status}`)
      }
      setRecord((prev) => ({ ...prev, [key]: value }))
      setSyncStatus('done')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSyncError(msg)
      setSyncStatus('error')
      setToast(`保存失敗: ${msg}`)
      throw err
    }
  }, [listRecordId, fmRecordId])

  const saveLeadNewcomer = useCallback(async (value: string) => {
    if (!primaryLead) return
    setSyncStatus('saving')
    setSyncError(null)
    try {
      const res = await fetch(`/api/leads/${primaryLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newcomer_flag: value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `status ${res.status}`)
      }
      setLeadsLocal((prev) =>
        prev.map((l) => (l.id === primaryLead.id ? { ...l, newcomer_flag: value } : l)),
      )
      setSyncStatus('done')
      setTimeout(() => setSyncStatus('idle'), 3000)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      setSyncError(msg)
      setSyncStatus('error')
      setToast(`保存失敗: ${msg}`)
      throw err
    }
  }, [primaryLead])

  const patchPrimaryLeadAppo = useCallback(
    async (patch: Record<string, string>) => {
      if (!primaryLead) return
      setSyncStatus('saving')
      setSyncError(null)
      try {
        const res = await fetch(`/api/leads/${primaryLead.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({})) as { error?: string }
          throw new Error(body.error ?? `status ${res.status}`)
        }
        setLeadsLocal((prev) =>
          prev.map((l) => (l.id === primaryLead.id ? { ...l, ...patch } : l)),
        )
        setSyncStatus('done')
        setTimeout(() => setSyncStatus('idle'), 3000)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        setSyncError(msg)
        setSyncStatus('error')
        setToast(`保存失敗: ${msg}`)
        throw err
      }
    },
    [primaryLead],
  )

  const doSaveMemo = useCallback(async () => {
    const currentMemo = memoRef.current
    if (currentMemo === ((initialRecord.case_memo as string) ?? '')) return
    await saveField('case_memo', currentMemo).catch(() => {})
  }, [saveField, initialRecord])

  const statusLead = primaryLead
    ? {
        id: primaryLead.id,
        status: primaryLead.status ?? primaryLead.last_call_result ?? '新規',
      }
    : null

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        width: '100%',
        minHeight: 0,
        marginTop: 0,
        paddingTop: 0,
        overflow: 'hidden',
        background: 'var(--color-gray-50)',
      }}
    >
      <div
        className="flex min-h-0"
        style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}
      >
        <ActionSidebar onEnd={doSaveMemo} listRecordId={listRecordId} leads={leadsLocal} />

        <div
          className="flex flex-col min-w-0 min-h-0"
          style={{ flex: 1, overflow: 'hidden', minHeight: 0 }}
        >
          <div
            style={{
              flexShrink: 0,
              background: 'var(--color-white)',
              borderBottom: '1px solid var(--color-gray-200)',
            }}
          >
            <SyncBanner status={syncStatus} error={syncError} onRetry={() => setSyncStatus('idle')} />
            {leadsLocal.length > 1 && (
              <div
                style={{
                  background: '#FFFBEB',
                  border: '1px solid #FDE68A',
                  borderRadius: 8,
                  padding: '10px 16px',
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                }}
              >
                <span style={{ fontSize: 12, color: '#92400E', fontWeight: 600 }}>
                  このリストには {leadsLocal.length} 件のリードが紐づいています
                </span>
                <select
                  value={selectedLeadId}
                  onChange={async (e) => {
                    const leadId = e.target.value
                    setSelectedLeadId(leadId)
                    const res = await fetch(`/api/list-records/${listRecordId}/selected-lead`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ selected_lead_id: leadId || null }),
                    })
                    if (!res.ok) {
                      const body = await res.json().catch(() => ({})) as { error?: string }
                      setToast(`リード選択の保存に失敗: ${body.error ?? res.status}`)
                      return
                    }
                    setRecord((prev) => ({ ...prev, selected_lead_id: leadId || null }))
                  }}
                  style={{
                    fontSize: 12,
                    border: '1px solid #FDE68A',
                    borderRadius: 6,
                    padding: '4px 8px',
                    background: '#fff',
                  }}
                >
                  <option value="">リードを選択...</option>
                  {leadsLocal.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.ad_name ?? '広告名なし'} — {(lead.inquiry_at ?? lead.inquiry_date)?.slice(0, 10) ?? '日付なし'}
                    </option>
                  ))}
                </select>
                <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                  選択したリードにアポOK内訳が反映されます
                </span>
              </div>
            )}
            <ListAttrHeader
              record={record}
              listRecordId={listRecordId}
              statusLead={statusLead}
              appoDetailStatus={primaryLead?.appo_detail_status ?? null}
              onStatusChange={(s) => {
                if (!primaryLead) return
                setLeadsLocal((prev) =>
                  prev.map((l) =>
                    l.id === primaryLead.id ? { ...l, status: s, last_call_result: s } : l,
                  ),
                )
              }}
              onAppoDetailChange={(detail) => {
                if (!primaryLead) return
                setLeadsLocal((prev) =>
                  prev.map((l) =>
                    l.id === primaryLead.id ? { ...l, appo_detail_status: detail } : l,
                  ),
                )
                setRecord((prev) => ({
                  ...prev,
                  chosei: detail === '調整中',
                  saiyo_ok: detail === '採用OK',
                  saiyo_ng: detail === '採用NG',
                  juchu: detail === '受注',
                }))
              }}
            />
          </div>
          <div style={{ flexShrink: 0 }}>
            <ListMainDetail
              record={record}
              disabled={isLocked}
              onSave={saveField}
              primaryLeadId={primaryLead?.id ?? null}
              leadNewcomerFlag={primaryLead?.newcomer_flag ?? ''}
              onSaveLeadNewcomer={saveLeadNewcomer}
              appoLead={primaryLead}
              onPatchAppoLead={patchPrimaryLeadAppo}
            />
          </div>

          <div
            className="flex gap-2 min-h-0"
            style={{
              flex: 1,
              overflowY: 'auto',
              minHeight: 0,
              padding: '16px 24px 40px',
            }}
          >
            <div
              className="min-h-0 min-w-0"
              style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
            >
              <HistoryTabs
                calls={calls}
                leads={leadsLocal}
                listRecordId={listRecordId}
                primaryLeadId={primaryLead?.id ?? null}
                primaryAppoDetailStatus={primaryLead?.appo_detail_status ?? null}
                onAppoDetailChange={(detail, affectedLeadId) => {
                  const tid = affectedLeadId ?? primaryLead?.id
                  if (tid) {
                    setLeadsLocal((prev) =>
                      prev.map((l) =>
                        l.id === tid ? { ...l, appo_detail_status: detail } : l,
                      ),
                    )
                  }
                  setRecord((prev) => ({
                    ...prev,
                    chosei: detail === '調整中',
                    saiyo_ok: detail === '採用OK',
                    saiyo_ng: detail === '採用NG',
                    juchu: detail === '受注',
                  }))
                }}
              />
            </div>
            <div
              className="flex flex-col gap-2 min-h-0"
              style={{
                width: '34%',
                flexShrink: 0,
                position: 'sticky',
                top: 0,
                alignSelf: 'flex-start',
                maxHeight: '100%',
              }}
            >
              <InquiryHistory leads={leadsLocal} />
              <MemoArea
                memo={memo}
                onChange={(v) => setMemo(v)}
                disabled={isLocked}
                presenceName={lockedBy}
              />
            </div>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  )
}
