import type { KpiData } from '../_lib/types'

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,.05)',
        borderRight: '1px solid #E5E7EB',
        padding: '12px 24px',
        flex: 1,
        minWidth: 0,
      }}
    >
      <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 4 }}>{label}</p>
      <p
        style={{
          fontSize: 22, fontWeight: 700, lineHeight: 1,
          color: accent ? '#0D9488' : '#111827',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </p>
      {sub && <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{sub}</p>}
    </div>
  )
}

export function KpiCardRow({ kpi, excludeNoAd }: { kpi: KpiData; excludeNoAd?: boolean }) {
  const fmt    = (n: number) => n.toLocaleString('ja-JP')
  const fmtPct = (n: number) => n.toFixed(1) + '%'
  const fmtYen = (n: number) => n > 0 ? '¥' + n.toLocaleString('ja-JP') : '-'

  return (
    <>
      <div style={{ display: 'flex', borderTop: '1px solid #E5E7EB' }}>
        <KpiCard label="総リード数"  value={fmt(kpi.totalLeads)} />
        <KpiCard label="総アポ数"   value={fmt(kpi.totalAppo)} accent />
        <KpiCard label="アポ率"     value={fmtPct(kpi.appoRate)} accent />
        <KpiCard label="完了率"     value={fmtPct(kpi.kanryoRate)} />
        <KpiCard label="総受注額"   value={fmtYen(kpi.totalRevenue)} />
        <KpiCard label="ROAS"       value={kpi.roas != null ? fmtPct(kpi.roas) : '-'} sub={kpi.roas == null ? '広告費未連携' : undefined} />
      </div>
      <div style={{ padding: '4px 24px 6px', fontSize: 10, color: '#9CA3AF', borderTop: '1px solid #F1F5F9', lineHeight: 1.6 }}>
        集計基準: 問い合わせ日（inquiry_at）優先 / 未設定はリスト作成日（list_created_at）で補完
        {excludeNoAd && '　|　広告名未設定リードは除外中'}
      </div>
    </>
  )
}
