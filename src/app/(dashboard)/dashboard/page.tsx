export default function DashboardPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-[18px] font-semibold mb-6" style={{ color: 'var(--color-gray-900)' }}>
        KPIトップ
      </h1>
      <div
        className="rounded-xl p-8 flex items-center justify-center"
        style={{
          border: '1px solid var(--color-gray-200)',
          backgroundColor: 'var(--color-white)',
          minHeight: 240,
        }}
      >
        <p className="text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
          Supabase接続後にKPIデータが表示されます
        </p>
      </div>
    </div>
  )
}
