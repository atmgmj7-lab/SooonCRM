'use client'

import { useRef, useState } from 'react'

type Rec = Record<string, unknown>

// ── Inline edit components ──────────────────────────────────────

function InlineText({
  label,
  value,
  colSpan,
  onSave,
  disabled,
  type = 'text',
  multiline,
}: {
  label: string
  value: string
  colSpan?: string
  onSave?: (v: string) => Promise<void>
  disabled?: boolean
  type?: string
  multiline?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [flash, setFlash] = useState(false)
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  async function commit() {
    setEditing(false)
    if (draft === value) return
    try {
      await onSave?.(draft)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch {
      setDraft(value)
    }
  }

  const cellStyle: React.CSSProperties = {
    background: flash ? '#dcfce7' : editing ? '#eff6ff' : undefined,
    transition: 'background 0.3s',
    gridColumn: colSpan,
  }

  return (
    <div className="flex flex-col min-w-0" style={cellStyle}>
      <div
        className="text-[9px] font-medium px-1.5 py-0.5 border-b"
        style={{
          background: 'var(--color-gray-100)',
          borderColor: 'var(--color-gray-200)',
          color: 'var(--color-gray-500)',
        }}
      >
        {label}
      </div>
      {editing ? (
        multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
            className="px-1.5 py-1 text-[11px] min-h-[44px] resize-none outline-none bg-transparent w-full"
            style={{ color: 'var(--color-gray-900)', fontFamily: 'inherit' }}
            autoFocus
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            type={type}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ref.current?.blur()
              if (e.key === 'Escape') { setDraft(value); setEditing(false) }
            }}
            className="px-1.5 py-1 text-[11px] font-medium min-h-[22px] outline-none bg-transparent tabular-nums w-full"
            style={{ color: 'var(--color-gray-900)', fontFamily: 'inherit' }}
            autoFocus
          />
        )
      ) : (
        <div
          className="px-1.5 py-1 text-[11px] font-medium min-h-[22px] cursor-text"
          style={{ color: draft ? 'var(--color-gray-900)' : 'var(--color-gray-300)' }}
          onClick={() => { if (!disabled) { setDraft(value); setEditing(true) } }}
        >
          {value || '—'}
        </div>
      )}
    </div>
  )
}

function InlinePhone({
  label,
  phones,
  onSave,
  disabled,
}: {
  label: string
  phones: string[]
  onSave?: (v: string[]) => Promise<void>
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(phones)
  const [flash, setFlash] = useState(false)

  async function save(next: string[]) {
    setDraft(next)
    const cleaned = next.filter(Boolean)
    try {
      await onSave?.(cleaned)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch { /* noop */ }
  }

  function update(i: number, v: string) {
    const next = [...draft]
    next[i] = v
    setDraft(next)
  }

  async function blur(i: number) {
    const cleaned = draft.filter(Boolean)
    if (JSON.stringify(cleaned) !== JSON.stringify(phones)) {
      await save(draft)
    }
  }

  return (
    <div
      className="flex flex-col min-w-0"
      style={{ background: flash ? '#dcfce7' : undefined, transition: 'background 0.3s' }}
    >
      <div
        className="text-[9px] font-medium px-1.5 py-0.5 border-b"
        style={{
          background: 'var(--color-gray-100)',
          borderColor: 'var(--color-gray-200)',
          color: 'var(--color-gray-500)',
        }}
      >
        {label}
      </div>
      <div className="px-1.5 py-1 flex flex-col gap-0.5">
        {draft.map((p, i) => (
          <input
            key={i}
            type="tel"
            value={p}
            disabled={disabled}
            onChange={(e) => update(i, e.target.value)}
            onBlur={() => blur(i)}
            className="text-[11px] tabular-nums outline-none bg-transparent w-full border-b border-dashed"
            style={{ borderColor: 'var(--color-gray-200)', color: 'var(--color-gray-900)' }}
          />
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={() => setDraft([...draft, ''])}
            className="text-[9px] self-start mt-0.5"
            style={{ color: 'var(--color-blue)' }}
          >
            ＋追加
          </button>
        )}
      </div>
    </div>
  )
}

function InlineCheckList({
  label,
  options,
  value,
  onSave,
  disabled,
}: {
  label: string
  options: string[]
  value: string[]
  onSave?: (v: string[]) => Promise<void>
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [flash, setFlash] = useState(false)

  async function toggle(opt: string) {
    const next = draft.includes(opt) ? draft.filter((x) => x !== opt) : [...draft, opt]
    setDraft(next)
    try {
      await onSave?.(next)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch { /* noop */ }
  }

  return (
    <div
      className="flex flex-col min-w-0"
      style={{ background: flash ? '#dcfce7' : undefined, transition: 'background 0.3s' }}
    >
      <div
        className="text-[9px] font-medium px-1.5 py-0.5 border-b"
        style={{
          background: 'var(--color-gray-100)',
          borderColor: 'var(--color-gray-200)',
          color: 'var(--color-gray-500)',
        }}
      >
        {label}
      </div>
      <div className="px-1.5 py-1 flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.includes(opt)}
              disabled={disabled}
              onChange={() => toggle(opt)}
              className="accent-teal-600"
            />
            <span className="text-[10px]" style={{ color: 'var(--color-gray-700)' }}>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

function InlineCheckbox({
  label,
  value,
  onSave,
  disabled,
}: {
  label: string
  value: boolean
  onSave?: (v: boolean) => Promise<void>
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [flash, setFlash] = useState(false)

  async function toggle() {
    const next = !draft
    setDraft(next)
    try {
      await onSave?.(next)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch { setDraft(value) }
  }

  return (
    <div
      className="flex flex-col min-w-0"
      style={{ background: flash ? '#dcfce7' : undefined, transition: 'background 0.3s' }}
    >
      <div
        className="text-[9px] font-medium px-1.5 py-0.5 border-b"
        style={{
          background: 'var(--color-gray-100)',
          borderColor: 'var(--color-gray-200)',
          color: 'var(--color-gray-500)',
        }}
      >
        {label}
      </div>
      <div className="px-1.5 py-1">
        <input
          type="checkbox"
          checked={draft}
          disabled={disabled}
          onChange={toggle}
          className="accent-teal-600"
        />
      </div>
    </div>
  )
}

function InlineRadio({
  label,
  options,
  value,
  onSave,
  disabled,
}: {
  label: string
  options: string[]
  value: string
  onSave?: (v: string) => Promise<void>
  disabled?: boolean
}) {
  const [draft, setDraft] = useState(value)
  const [flash, setFlash] = useState(false)

  async function pick(v: string) {
    setDraft(v)
    try {
      await onSave?.(v)
      setFlash(true)
      setTimeout(() => setFlash(false), 800)
    } catch { setDraft(value) }
  }

  return (
    <div
      className="flex flex-col min-w-0"
      style={{ background: flash ? '#dcfce7' : undefined, transition: 'background 0.3s' }}
    >
      <div
        className="text-[9px] font-medium px-1.5 py-0.5 border-b"
        style={{
          background: 'var(--color-gray-100)',
          borderColor: 'var(--color-gray-200)',
          color: 'var(--color-gray-500)',
        }}
      >
        {label}
      </div>
      <div className="px-1.5 py-1 flex gap-2 flex-wrap">
        {options.map((opt) => (
          <label key={opt} className="flex items-center gap-1 cursor-pointer">
            <input
              type="radio"
              name={`radio-${label}`}
              checked={draft === opt}
              disabled={disabled}
              onChange={() => pick(opt)}
              className="accent-teal-600"
            />
            <span className="text-[10px]" style={{ color: 'var(--color-gray-700)' }}>{opt}</span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ── Section wrapper ─────────────────────────────────────────────

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="border-b" style={{ borderColor: 'var(--color-gray-200)' }}>
      <div
        className="text-[10px] font-bold px-2 py-1 uppercase tracking-wider"
        style={{
          color: '#0D9488',
          background: '#f0fdfa',
          borderLeft: '3px solid #0D9488',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

// ── Grid row ────────────────────────────────────────────────────

function GridRow({
  cols,
  children,
}: {
  cols: string
  children: React.ReactNode
}) {
  return (
    <div
      className="grid divide-x divide-gray-200 border-b border-gray-200"
      style={{ gridTemplateColumns: cols }}
    >
      {children}
    </div>
  )
}

// ── Main component ──────────────────────────────────────────────

interface Props {
  record: Rec
  disabled?: boolean
  onSave: (key: string, value: unknown) => Promise<void>
  primaryLeadId: string | null
  leadNewcomerFlag: string
  onSaveLeadNewcomer: (value: string) => Promise<void>
  appoLead: {
    id: string
    status: string | null
    last_call_result: string | null
    appo_detail_status?: string | null
    appo_date?: string | null
    appo_time?: string | null
    appo_detail?: string | null
  } | null
  onPatchAppoLead: (patch: Record<string, string>) => Promise<void>
}

const HP_OPTIONS = ['あり', 'なし', '不明']

export function ListMainDetail({
  record,
  disabled,
  onSave,
  primaryLeadId,
  leadNewcomerFlag,
  onSaveLeadNewcomer,
  appoLead,
  onPatchAppoLead,
}: Props) {
  const phones = (record.phone_numbers as string[] | null) ?? []

  const s = (key: string) => (record[key] as string) ?? ''

  return (
    <div
      className="shrink-0 border-b overflow-y-auto"
      style={{
        background: 'var(--color-white)',
        borderColor: 'var(--color-gray-200)',
        maxHeight: '40vh',
      }}
    >
      <Section title="基本情報">
        <GridRow cols="1fr 1fr">
          <InlineText label="顧客ID" value={s('customer_id')} disabled={true}
            onSave={undefined} />
          <InlineText
            label="新人フラグ"
            value={leadNewcomerFlag}
            disabled={disabled || !primaryLeadId}
            onSave={async (v) => { await onSaveLeadNewcomer(v) }}
          />
        </GridRow>
        <GridRow cols="3fr 2fr 1.2fr 1.5fr">
          <InlineText label="会社名" value={s('company_name')} disabled={disabled}
            onSave={(v) => onSave('company_name', v)} />
          <InlineText label="代表名" value={s('representative_name')} disabled={disabled}
            onSave={(v) => onSave('representative_name', v)} />
          <InlineText label="役職" value={s('title')} disabled={disabled}
            onSave={(v) => onSave('title', v)} />
          <InlineText label="都道府県" value={s('prefecture')} disabled={disabled}
            onSave={(v) => onSave('prefecture', v)} />
        </GridRow>
        <GridRow cols="1fr 2fr 3fr">
          <InlineText label="業種" value={s('industry')} disabled={disabled}
            onSave={(v) => onSave('industry', v)} />
          <InlineText label="住所" value={s('address')} disabled={disabled}
            onSave={(v) => onSave('address', v)} />
          <InlineText label="会社メール" value={s('company_email')} disabled={disabled}
            onSave={(v) => onSave('company_email', v)} />
        </GridRow>
        <GridRow cols="1fr 1fr 1fr 1fr">
          <InlineText label="営業開始時間" value={s('business_start_time')} disabled={disabled}
            onSave={(v) => onSave('business_start_time', v)} />
          <InlineText label="営業終了時間" value={s('business_end_time')} disabled={disabled}
            onSave={(v) => onSave('business_end_time', v)} />
          <InlineText label="ホームページURL" value={s('homepage_url')} disabled={disabled}
            onSave={(v) => onSave('homepage_url', v)} />
          <InlineText label="担当ZOOM" value={s('zoom_url')} disabled={disabled}
            onSave={(v) => onSave('zoom_url', v)} />
        </GridRow>
      </Section>

      <Section title="連絡先">
        <GridRow cols="2fr 1fr">
          <InlinePhone
            label="電話番号"
            phones={phones}
            disabled={disabled}
            onSave={(v) => onSave('phone_numbers', v)}
          />
          <InlineRadio
            label="ホームページ有無"
            options={HP_OPTIONS}
            value={s('homepage_exists')}
            disabled={disabled}
            onSave={(v) => onSave('homepage_exists', v)}
          />
        </GridRow>
      </Section>

      <Section title="再コール・商談">
        <GridRow cols="1fr 1fr 1fr 1fr">
          <InlineText label="再コール日" value={s('recall_date')} type="date"
            disabled={disabled} onSave={(v) => onSave('recall_date', v)} />
          <InlineText label="再コール時刻" value={s('recall_time')}
            disabled={disabled} onSave={(v) => onSave('recall_time', v)} />
          <InlineText label="商談日" value={s('meeting_date')} type="date"
            disabled={disabled} onSave={(v) => onSave('meeting_date', v)} />
          <InlineText label="商談時刻" value={s('meeting_time')}
            disabled={disabled} onSave={(v) => onSave('meeting_time', v)} />
        </GridRow>
      </Section>

      {['アポOK', '調整中', '採用OK', '採用NG', '受注'].includes(appoLead?.status ?? '') && appoLead && (
        <section
          style={{
            background: '#fff',
            border: '1px solid #D1FAE5',
            borderRadius: 10,
            padding: '14px 20px',
            marginBottom: 16,
          }}
        >
          <h3
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: '#065F46',
              marginBottom: 14,
              borderBottom: '1px solid #D1FAE5',
              paddingBottom: 8,
            }}
          >
            アポOK 内訳
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label
                style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}
              >
                アポ内訳ステータス
              </label>
              <select
                value={appoLead.appo_detail_status ?? ''}
                disabled={disabled}
                onChange={async (e) => {
                  await onPatchAppoLead({ appo_detail_status: e.target.value })
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              >
                <option value="">選択してください</option>
                <option value="調整中">調整中（商談日程調整中）</option>
                <option value="採用OK">採用OK（商談着座済み）</option>
                <option value="採用NG">採用NG（商談後NG）</option>
                <option value="受注">受注（契約済み）</option>
              </select>
            </div>

            <div>
              <label
                style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}
              >
                商談日
              </label>
              <input
                type="date"
                defaultValue={appoLead.appo_date ?? ''}
                disabled={disabled}
                onBlur={async (e) => {
                  await onPatchAppoLead({ appo_date: e.target.value })
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div>
              <label
                style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}
              >
                商談時刻
              </label>
              <input
                type="time"
                defaultValue={appoLead.appo_time ?? ''}
                disabled={disabled}
                onBlur={async (e) => {
                  await onPatchAppoLead({ appo_time: e.target.value })
                }}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  fontSize: 13,
                }}
              />
            </div>

            <div style={{ gridColumn: 'span 2' }}>
              <label
                style={{ fontSize: 11, color: '#9CA3AF', display: 'block', marginBottom: 4 }}
              >
                アポ詳細・備考
              </label>
              <textarea
                defaultValue={appoLead.appo_detail ?? ''}
                disabled={disabled}
                onBlur={async (e) => {
                  await onPatchAppoLead({ appo_detail: e.target.value })
                }}
                rows={3}
                style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #E5E7EB',
                  borderRadius: 6,
                  fontSize: 13,
                  resize: 'vertical',
                }}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
