'use client'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from 'recharts'
import { ALL_METRICS, type MetricKey } from '../_lib/metrics'

const METRIC_COLORS: Record<string, string> = {
  leads: '#0D9488', appo: '#10B981', kanryo: '#6366F1',
  mikanryo: '#F59E0B', appoRate: '#0EA5E9', kanryoRate: '#8B5CF6',
  adSpend: '#EF4444', roas: '#F97316', cpa: '#DC2626',
  clicks: '#64748B', reach: '#94A3B8', impressions: '#CBD5E1',
  totalRevenue: '#15803D', cpo: '#B91C1C',
  saiyo: '#2DD4BF', saiyoNg: '#F43F5E', juchu: '#7C3AED',
  chosei: '#FB923C', mikomiA: '#34D399', mikomiB: '#60A5FA', mikomiC: '#A78BFA',
}

// GA4モード: 広告ごとに色を割り当てる
const AD_PALETTE = ['#0D9488', '#6366F1', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6', '#0EA5E9', '#F97316']

const RATE_KEYS = new Set<string>(ALL_METRICS.filter((m) => m.category === 'rate').map((m) => m.key))

interface Props {
  data: Record<string, unknown>[]
  xKey: string
  selectedMetrics: MetricKey[]
  adNames?: string[]  // GA4モード: 広告名リスト
}

function formatVal(value: unknown, metricKey: string): string {
  const n = Number(value)
  return RATE_KEYS.has(metricKey) ? `${n.toFixed(1)}%` : n.toLocaleString()
}

export function DynamicChart({ data, xKey, selectedMetrics, adNames }: Props) {
  const ga4Mode = !!adNames && adNames.length > 0

  if (selectedMetrics.length === 0) {
    return (
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
        上の「グラフ表示指標を選択」からメトリクスを選んでください
      </div>
    )
  }

  const tooltipFormatter = (value: unknown, name: unknown): [string, string] => {
    const nameStr = String(name)
    if (nameStr.includes('::')) {
      const sepIdx = nameStr.indexOf('::')
      const adPart = nameStr.slice(0, sepIdx)
      const metricKey = nameStr.slice(sepIdx + 2)
      const meta = ALL_METRICS.find((m) => m.key === metricKey)
      return [
        formatVal(value, metricKey),
        `${adPart.slice(0, 10)} / ${meta?.label ?? metricKey}`,
      ]
    }
    const meta = ALL_METRICS.find((x) => x.key === nameStr)
    return [formatVal(value, nameStr), meta?.label ?? nameStr]
  }

  const legendFormatter = (value: string): string => {
    if (value.includes('::')) {
      const sepIdx = value.indexOf('::')
      const adPart = value.slice(0, sepIdx)
      const metricKey = value.slice(sepIdx + 2)
      const meta = ALL_METRICS.find((m) => m.key === metricKey)
      return `${adPart.slice(0, 10)} / ${meta?.label ?? metricKey}`
    }
    return ALL_METRICS.find((m) => m.key === value)?.label ?? value
  }

  return (
    <ResponsiveContainer width="100%" height={ga4Mode ? 320 : 280}>
      <ComposedChart data={data} margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
        <XAxis dataKey={xKey} tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="left" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
        <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
        <Tooltip
          contentStyle={{ fontSize: 11, borderRadius: 6, border: '1px solid #E5E7EB' }}
          formatter={tooltipFormatter}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} formatter={legendFormatter} />

        {ga4Mode
          ? adNames!.flatMap((adName, adIdx) =>
              selectedMetrics.map((key) => {
                const meta = ALL_METRICS.find((m) => m.key === key)
                const color = AD_PALETTE[adIdx % AD_PALETTE.length]
                const dataKey = `${adName}::${key}`
                const isRate = RATE_KEYS.has(key as string)
                const axis = isRate ? 'right' : 'left'

                if (isRate || meta?.chartType === 'line') {
                  return (
                    <Line
                      key={dataKey}
                      type="monotone"
                      dataKey={dataKey}
                      name={dataKey}
                      stroke={color}
                      strokeWidth={2}
                      dot={false}
                      yAxisId={axis}
                      strokeDasharray={adIdx > 0 ? `${4 + adIdx * 2} 2` : undefined}
                    />
                  )
                }
                return (
                  <Bar
                    key={dataKey}
                    dataKey={dataKey}
                    name={dataKey}
                    fill={color}
                    fillOpacity={0.8}
                    radius={[2, 2, 0, 0]}
                    yAxisId={axis}
                  />
                )
              })
            )
          : selectedMetrics.map((key, idx) => {
              const meta = ALL_METRICS.find((m) => m.key === key)
              if (!meta) return null
              const color = METRIC_COLORS[key] ?? AD_PALETTE[idx % AD_PALETTE.length]
              const isRate = RATE_KEYS.has(key as string)
              const axis = isRate ? 'right' : 'left'

              if (meta.chartType === 'line') {
                return (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={key}
                    stroke={color}
                    strokeWidth={2}
                    dot={false}
                    yAxisId={axis}
                  />
                )
              }
              return (
                <Bar
                  key={key}
                  dataKey={key}
                  name={key}
                  fill={color}
                  fillOpacity={0.85}
                  radius={[2, 2, 0, 0]}
                  yAxisId={axis}
                />
              )
            })}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
