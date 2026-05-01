'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Creative {
  id: string
  external_id: string
  platform: string
  name: string
  thumbnail_url: string | null
}

export default function CreativesPage() {
  const [creatives, setCreatives] = useState<Creative[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const supabase = createClient()
      const { data: tenantData } = await supabase.from('tenants').select('id').limit(1).single()
      if (!tenantData || cancelled) { setLoading(false); return }

      const { data } = await supabase
        .from('ad_creatives')
        .select('*')
        .eq('tenant_id', tenantData.id)
        .not('platform', 'in', '("tiktok","line")')
        .order('name', { ascending: true })

      if (!cancelled) {
        setCreatives((data as Creative[]) ?? [])
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <h1 className="text-[22px] font-bold mb-6" style={{ color: 'var(--color-gray-900)' }}>
        クリエイティブ一覧
      </h1>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)' }}>
        <table className="w-full text-[13px] border-collapse">
          <thead>
            <tr style={{ background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)' }}>
              {['', 'クリエイティブ名', '媒体', 'ID'].map((h, i) => (
                <th key={i} className="text-left px-4 py-2.5 font-medium" style={{ color: 'var(--color-gray-600)' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-white)' }}>
                  <td className="px-4 py-3">
                    <span className="inline-block w-10 h-10 rounded animate-pulse" style={{ background: 'var(--color-gray-100)' }} />
                  </td>
                  {Array.from({ length: 3 }).map((_, j) => (
                    <td key={j} className="px-4 py-3">
                      <span className="inline-block h-4 rounded animate-pulse" style={{ width: j === 0 ? '140px' : '80px', background: 'var(--color-gray-100)' }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : creatives.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-16 text-center text-[13px]" style={{ color: 'var(--color-gray-400)', background: 'var(--color-white)' }}>
                  データがありません
                </td>
              </tr>
            ) : (
              creatives.map((c) => (
                <tr key={c.id} style={{ borderBottom: '1px solid var(--color-gray-200)', background: 'var(--color-white)' }}>
                  <td className="px-4 py-3">
                    {c.thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.thumbnail_url} alt={c.name} width={40} height={40} className="rounded object-cover" style={{ width: 40, height: 40 }} />
                    ) : (
                      <div className="rounded flex items-center justify-center text-[11px]" style={{ width: 40, height: 40, background: 'var(--color-gray-100)', color: 'var(--color-gray-400)' }}>
                        No img
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium" style={{ color: 'var(--color-gray-900)' }}>{c.name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-gray-600)' }}>{c.platform}</td>
                  <td className="px-4 py-3 tabular-nums" style={{ color: 'var(--color-gray-400)', fontFamily: 'monospace', fontSize: '12px' }}>{c.external_id}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
