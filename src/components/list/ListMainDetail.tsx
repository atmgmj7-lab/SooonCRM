'use client'

type Rec = Record<string, unknown>

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-w-0">
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
      <div
        className="px-1.5 py-1 text-[11px] font-medium min-h-[22px]"
        style={{ color: 'var(--color-gray-900)' }}
      >
        {children ?? <span style={{ color: 'var(--color-gray-300)' }}>—</span>}
      </div>
    </div>
  )
}

function EditField({
  label,
  value,
  type = 'text',
  onChange,
  disabled,
}: {
  label: string
  value: string
  type?: string
  onChange?: (v: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-col min-w-0">
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
      <input
        type={type}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className="px-1.5 py-1 text-[11px] font-medium min-h-[22px] bg-transparent outline-none tabular-nums w-full"
        style={{
          color: 'var(--color-gray-900)',
          fontFamily: 'inherit',
          cursor: disabled ? 'not-allowed' : 'text',
          opacity: disabled ? 0.5 : 1,
        }}
      />
    </div>
  )
}

interface Props {
  record: Rec
  recallDate: string
  recallTime: string
  onRecallDateChange?: (v: string) => void
  onRecallTimeChange?: (v: string) => void
  disabled?: boolean
}

export function ListMainDetail({
  record,
  recallDate,
  recallTime,
  onRecallDateChange,
  onRecallTimeChange,
  disabled,
}: Props) {
  const phones = (record.phone_numbers as string[] | null) ?? []

  return (
    <div
      className="shrink-0 border-b"
      style={{ background: 'var(--color-white)', borderColor: 'var(--color-gray-200)' }}
    >
      {/* Row 1: 会社名 / 代表名 / 役職 / 都道府県 */}
      <div
        className="grid divide-x divide-gray-200 border-b border-gray-200"
        style={{ gridTemplateColumns: '3fr 2fr 1.2fr 1.5fr' }}
      >
        <Field label="会社名">{record.company_name as string}</Field>
        <Field label="代表名">{record.representative_name as string}</Field>
        <Field label="役職">{record.title as string}</Field>
        <Field label="都道府県">{record.prefecture as string}</Field>
      </div>

      {/* Row 2: 電話番号 / メール / 住所 */}
      <div
        className="grid divide-x divide-gray-200 border-b border-gray-200"
        style={{ gridTemplateColumns: '2fr 2fr 4fr' }}
      >
        <Field label="電話番号">
          <div className="flex flex-col tabular-nums">
            {phones.length > 0
              ? phones.map((p, i) => <span key={i}>{p}</span>)
              : <span style={{ color: 'var(--color-gray-300)' }}>—</span>}
          </div>
        </Field>
        <Field label="会社mail">{record.company_email as string}</Field>
        <Field label="住所">{record.address as string}</Field>
      </div>

      {/* Row 3: 再コール日（編集可） / 再コール時刻（編集可） */}
      <div
        className="grid divide-x divide-gray-200"
        style={{ gridTemplateColumns: '2fr 2fr' }}
      >
        <EditField
          label="再コール日"
          value={recallDate}
          type="date"
          onChange={onRecallDateChange}
          disabled={disabled}
        />
        <EditField
          label="再コール時刻"
          value={recallTime}
          onChange={onRecallTimeChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
