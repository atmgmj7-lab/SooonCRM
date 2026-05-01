'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Campaign {
  id: string
  external_id: string
  platform: string
  name: string
  objective: string | null
  status: string
  created_at: string
}

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  active: { bg: 'var(--color-success-bg)', color: 'var(--color-success)', label: '配信中' },
  paused: { bg: 'var(--color-warning-bg)', color: 'var(--color-warning)', label: '一時停止' },
  ended:  { bg: 'var(--color-gray-100)',   color: 'var(--color-gray-600)', label: '終了' },
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single()
      if (!tenantData || cancelled) { setLoading(false); return }

      const { data } = await supabase
        .from('ad_campaigns')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .not('platform', 'in', '("tiktok","line")')
        .order('created_at', { ascending: false })

      if (!cancelled) {
        setCampaigns((data as Campaign[]) ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <h1 className="text-[22px] font-bold mb-6" style={{ color: 'var(--color-gray-900)' }}>
        キャンペーン一覧
      </h1>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)' }}>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              {['キャンペーン名', '媒体', 'ステータス', '目的', '作成日'].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--color-gray-600)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-white)' }}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <span
                        className="inline-block h-4 rounded animate-pulse"
                        style={{ width: j === 0 ? '160px' : '80px', background: 'var(--color-gray-100)' }}
                      />
                    </td>
                  ))}
                </tr>
              ))
            ) : campaigns.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center text-[13px]" style={{ color: 'var(--color-gray-400)', background: 'var(--color-white)' }}>
                  データがありません
                </td>
              </tr>
            ) : (
              campaigns.map((c) => {
                const s = STATUS_STYLES[c.status] ?? STATUS_STYLES.ended
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-white)' }}>
                    <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-gray-900)' }}>{c.name}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-gray-600)' }}>{c.platform}</td>
                    <td className="px-4 py-3">
                      <span className="inline-block px-2 py-0.5 rounded text-[12px] font-medium" style={{ background: s.bg, color: s.color }}>
                        {s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3" style={{ color: 'var(--color-gray-600)' }}>{c.objective ?? '—'}</td>
                    <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--color-gray-600)' }}>{formatDate(c.created_at)}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
