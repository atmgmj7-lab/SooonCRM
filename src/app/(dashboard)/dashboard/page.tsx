import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, subMonths, subDays } from 'date-fns'

const TENANT_ID = 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'

const APPO_STATUSES = [
  'アポOK', '調整中', '調整中（リスク/商談前）',
  '採用OK', '採用OK（商談着座）', '採用NG', '受注',
]
const MIKANRYO_STATUSES = ['新規', '未コール', '留守', '見込みA', '見込みB', '見込みC']

function countAppo(leads: { status: string }[]): number {
  return leads.filter((l) => APPO_STATUSES.includes(l.status || '')).length
}

function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return <span style={{ fontSize: 11, color: '#9CA3AF' }}>先月なし</span>
  const positive = delta >= 0
  const color = delta === 0 ? '#9CA3AF' : positive ? '#10B981' : '#EF4444'
  const sign = positive ? '▲ +' : '▼ '
  return (
    <span style={{ fontSize: 11, color, fontWeight: 600, marginLeft: 6 }}>
      {sign}{Math.abs(delta).toFixed(1)}% 先月比
    </span>
  )
}

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return null
  return ((current - previous) / previous) * 100
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const now = new Date()

  const thisStart = format(startOfMonth(now), 'yyyy-MM-dd')
  const thisEnd   = format(endOfMonth(now), 'yyyy-MM-dd')
  const lastStart = format(startOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
  const lastEnd   = format(endOfMonth(subMonths(now, 1)), 'yyyy-MM-dd')
  const sevenDaysAgo = format(subDays(now, 7), 'yyyy-MM-dd')

  const [thisMonthRes, lastMonthRes, callsRes, mikanryoRes] = await Promise.all([
    supabase
      .from('leads')
      .select('id, status, deal_amount')
      .eq('tenant_id', TENANT_ID)
      .gte('inquiry_at', thisStart)
      .lte('inquiry_at', thisEnd),
    supabase
      .from('leads')
      .select('id, status, deal_amount')
      .eq('tenant_id', TENANT_ID)
      .gte('inquiry_at', lastStart)
      .lte('inquiry_at', lastEnd),
    supabase
      .from('calls')
      .select('call_date, call_result, agent_name')
      .eq('tenant_id', TENANT_ID)
      .gte('call_date', sevenDaysAgo),
    supabase
      .from('leads')
      .select('id, status')
      .eq('tenant_id', TENANT_ID)
      .in('status', MIKANRYO_STATUSES),
  ])

  const thisMonth = thisMonthRes.data ?? []
  const lastMonth = lastMonthRes.data ?? []
  const calls7d   = callsRes.data ?? []
  const mikanryo  = mikanryoRes.data ?? []

  // 今月・先月 集計
  const thisLeads  = thisMonth.length
  const lastLeads  = lastMonth.length
  const thisAppo   = countAppo(thisMonth as { status: string }[])
  const lastAppo   = countAppo(lastMonth as { status: string }[])
  const thisAppoRate = thisLeads > 0 ? (thisAppo / thisLeads) * 100 : 0
  const lastAppoRate = lastLeads > 0 ? (lastAppo / lastLeads) * 100 : 0

  // 直近7日 集計
  const calls7dCount = calls7d.length
  const appo7dCount  = (calls7d as { call_result: string | null }[]).filter(
    (c) => APPO_STATUSES.includes(c.call_result || '')
  ).length
  const appo7dRate   = calls7dCount > 0 ? (appo7dCount / calls7dCount) * 100 : 0

  // 未完了内訳
  const mikanryoList = mikanryo as { status: string }[]
  const mikanryoCount = mikanryoList.length
  const rusuCount    = mikanryoList.filter((l) => l.status === '留守').length
  const mikomiCount  = mikanryoList.filter((l) => ['見込みA','見込みB','見込みC'].includes(l.status || '')).length
  const miCallCount  = mikanryoList.filter((l) => ['未コール','新規'].includes(l.status || '')).length

  const cardStyle: React.CSSProperties = {
    background: '#fff', border: '1px solid #E5E7EB', borderRadius: 10,
    padding: '16px 20px', flex: 1, minWidth: 0,
  }

  return (
    <div style={{ padding: '24px', maxWidth: 1200 }}>
      <h1 style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.4px', marginBottom: 4, color: '#0F172A' }}>
        KPIトップ
      </h1>
      <p style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 20 }}>
        {format(now, 'yyyy年M月d日')} 時点
      </p>

      {/* 未完了リードアラートバナー */}
      {mikanryoCount > 0 && (
        <div style={{
          background: '#FFF7ED', border: '1px solid #FED7AA',
          borderRadius: 8, padding: '10px 16px',
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        }}>
          <span style={{ fontSize: 16 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
              未完了リードが {mikanryoCount.toLocaleString()} 件あります
            </span>
            <span style={{ fontSize: 12, color: '#B45309', marginLeft: 8 }}>
              （未コール: {miCallCount}件 / 留守: {rusuCount}件 / 見込みA/B/C: {mikomiCount}件）
            </span>
          </div>
          <Link
            href="/leads"
            style={{ fontSize: 12, color: '#0D9488', textDecoration: 'none', whiteSpace: 'nowrap' }}
          >
            一覧を見る →
          </Link>
        </div>
      )}

      {/* 今月 vs 先月 比較KPIカード */}
      <div style={{ marginBottom: 8 }}>
        <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 10, letterSpacing: '.5px' }}>
          今月（{format(now, 'M月')}）vs 先月 比較
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>リード数</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                {thisLeads.toLocaleString()}
              </span>
              <DeltaBadge delta={calcDelta(thisLeads, lastLeads)} />
            </div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>先月: {lastLeads.toLocaleString()}件</p>
          </div>

          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>アポ数</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#0D9488', fontVariantNumeric: 'tabular-nums' }}>
                {thisAppo.toLocaleString()}
              </span>
              <DeltaBadge delta={calcDelta(thisAppo, lastAppo)} />
            </div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>先月: {lastAppo.toLocaleString()}件</p>
          </div>

          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>アポ率</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: '#0D9488', fontVariantNumeric: 'tabular-nums' }}>
                {thisAppoRate.toFixed(1)}%
              </span>
              <DeltaBadge delta={calcDelta(thisAppoRate, lastAppoRate)} />
            </div>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>先月: {lastAppoRate.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* 直近7日間 活動サマリー */}
      <div style={{ marginTop: 24, marginBottom: 8 }}>
        <p style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600, marginBottom: 10, letterSpacing: '.5px' }}>
          直近7日間の架電活動
        </p>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>架電数</p>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
              {calls7dCount.toLocaleString()}
            </span>
          </div>

          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>アポ獲得数</p>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#0D9488', fontVariantNumeric: 'tabular-nums' }}>
              {appo7dCount.toLocaleString()}
            </span>
          </div>

          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>アポ率（7日）</p>
            <span style={{ fontSize: 28, fontWeight: 700, color: '#0D9488', fontVariantNumeric: 'tabular-nums' }}>
              {appo7dRate.toFixed(1)}%
            </span>
          </div>

          <div style={cardStyle}>
            <p style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 6 }}>未完了リード</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 28, fontWeight: 700, color: mikanryoCount > 0 ? '#B45309' : '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                {mikanryoCount.toLocaleString()}
              </span>
              <span style={{ fontSize: 11, color: '#9CA3AF' }}>件</span>
            </div>
          </div>
        </div>
      </div>

      {/* アナリティクスへのリンク */}
      <div style={{ marginTop: 24 }}>
        <Link
          href="/analytics"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: '#0D9488', textDecoration: 'none',
            border: '1px solid #0D9488', borderRadius: 6, padding: '6px 14px',
          }}
        >
          詳細アナリティクスを見る →
        </Link>
      </div>
    </div>
  )
}
