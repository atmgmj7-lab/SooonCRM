import { ChevronLeft, ChevronRight, Plus, Ban, Phone, PhoneOff } from 'lucide-react'

function SideBtn({
  icon,
  label,
  accent,
  danger,
}: {
  icon: React.ReactNode
  label: string
  accent?: boolean
  danger?: boolean
}) {
  const iconColor = accent
    ? 'var(--color-blue)'
    : danger
      ? 'var(--color-danger)'
      : 'var(--color-gray-600)'
  return (
    <button className="flex flex-col items-center gap-0.5 w-full px-1 py-2 rounded hover:bg-slate-200 transition-colors cursor-default">
      <span style={{ color: iconColor }}>{icon}</span>
      <span className="text-[9px] leading-tight text-center" style={{ color: 'var(--color-gray-400)' }}>
        {label}
      </span>
    </button>
  )
}

export function ActionSidebar({ onEnd }: { onEnd?: () => void }) {
  return (
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
      <SideBtn icon={<Phone size={15} />} label="開始" accent />
      <button
        onClick={onEnd}
        className="flex flex-col items-center gap-0.5 w-full px-1 py-2 rounded hover:bg-slate-200 transition-colors cursor-default"
      >
        <span style={{ color: 'var(--color-gray-600)' }}><PhoneOff size={15} /></span>
        <span className="text-[9px] leading-tight text-center" style={{ color: 'var(--color-gray-400)' }}>終了</span>
      </button>
    </div>
  )
}
