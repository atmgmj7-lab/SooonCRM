'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Ban, Phone, PhoneOff } from 'lucide-react'

type LeadItem = {
  id: string
  inquiry_date: string | null
  ad_name: string | null
}

function SideBtn({
  icon,
  label,
  accent,
  danger,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  accent?: boolean
  danger?: boolean
  onClick?: () => void
}) {
  const iconColor = accent
    ? 'var(--color-blue)'
    : danger
      ? 'var(--color-danger)'
      : 'var(--color-gray-600)'
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center gap-0.5 w-full px-1 py-2 rounded hover:bg-slate-200 transition-colors"
    >
      <span style={{ color: iconColor }}>{icon}</span>
      <span className="text-[9px] leading-tight text-center" style={{ color: 'var(--color-gray-400)' }}>
        {label}
      </span>
    </button>
  )
}

type Props = {
  onEnd?: () => void
  listRecordId?: string
  leads?: LeadItem[]
  onCallStarted?: (callId: string) => void
}

export function ActionSidebar({ onEnd, listRecordId, leads = [], onCallStarted }: Props) {
  const [showModal,    setShowModal]    = useState(false)
  const [selectedLead, setSelectedLead] = useState<string | null>(null)
  const [starting,     setStarting]     = useState(false)

  async function createCall(leadId: string | null) {
    if (!listRecordId) return
    setStarting(true)
    try {
      const res = await fetch('/api/calls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          list_record_id: listRecordId,
          lead_id:        leadId,
          called_at:      new Date().toISOString(),
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        alert(`架電開始エラー: ${body.error ?? res.status}`)
        return
      }
      const data = await res.json() as { call?: { id: string } }
      if (data.call?.id) onCallStarted?.(data.call.id)
    } catch (err) {
      alert(`架電開始エラー: ${String(err)}`)
    } finally {
      setStarting(false)
      setShowModal(false)
    }
  }

  function handleStart() {
    if (!listRecordId) {
      alert('リスト情報が未設定です')
      return
    }
    if (leads.length === 0) {
      alert('先にリードを登録してください')
      return
    }
    if (leads.length === 1) {
      createCall(leads[0].id)
      return
    }
    setSelectedLead(leads[0].id)
    setShowModal(true)
  }

  return (
    <>
      <div
        className="w-14 shrink-0 flex flex-col items-center py-2 gap-0.5 border-r border-slate-200"
        style={{ background: 'var(--color-gray-50)' }}
      >
        <SideBtn icon={<ChevronLeft size={15} />} label="前へ" />
        <SideBtn icon={<ChevronRight size={15} />} label="次へ" />
        <div className="w-8 my-1.5 border-t border-slate-200" />
        <SideBtn icon={<Plus size={15} />} label="新規追加" />
        <SideBtn icon={<Ban size={15} />} label="対象外" danger />
        <div className="flex-1" />
        <SideBtn icon={<Phone size={15} />} label="開始" accent onClick={handleStart} />
        <button
          onClick={onEnd}
          className="flex flex-col items-center gap-0.5 w-full px-1 py-2 rounded hover:bg-slate-200 transition-colors"
        >
          <span style={{ color: 'var(--color-gray-600)' }}><PhoneOff size={15} /></span>
          <span className="text-[9px] leading-tight text-center" style={{ color: 'var(--color-gray-400)' }}>終了</span>
        </button>
      </div>

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.4)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="rounded-2xl shadow-xl overflow-hidden"
            style={{ background: 'var(--color-white)', width: 300 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="px-4 py-3 border-b text-[13px] font-semibold"
              style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-gray-900)' }}
            >
              どのリードへの架電ですか？
            </div>
            <div className="divide-y" style={{ borderColor: 'var(--color-gray-100)' }}>
              {leads.map((lead, i) => (
                <label
                  key={lead.id}
                  className="flex items-start gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50"
                >
                  <input
                    type="radio"
                    name="lead-select"
                    value={lead.id}
                    checked={selectedLead === lead.id}
                    onChange={() => setSelectedLead(lead.id)}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="text-[13px] font-medium" style={{ color: 'var(--color-gray-900)' }}>
                      {lead.ad_name ?? '（広告名未設定）'}
                    </div>
                    <div className="text-[11px]" style={{ color: 'var(--color-gray-400)' }}>
                      {lead.inquiry_date ?? '日付不明'} 問い合わせ
                      {i === 0 && (
                        <span className="ml-2" style={{ color: 'var(--color-blue)' }}>最新</span>
                      )}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--color-gray-200)' }}>
              <button
                disabled={!selectedLead || starting}
                onClick={() => createCall(selectedLead)}
                className="w-full py-2 rounded-lg text-[13px] font-semibold transition-colors disabled:opacity-50"
                style={{ background: 'var(--color-blue)', color: 'var(--color-white)' }}
              >
                {starting ? '開始中...' : '架電開始'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
