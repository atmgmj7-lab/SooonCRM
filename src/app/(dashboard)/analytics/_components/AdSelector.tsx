'use client'
import { useEffect, useState } from 'react'
import type { AdSummaryRow } from '../_lib/types'

type MetaInsight = {
  adName: string
  creativeImageUrl: string | null
}

interface Props {
  ads: AdSummaryRow[]
  selected: string[]
  onChange: (selected: string[]) => void
}

export function AdSelector({ ads, selected, onChange }: Props) {
  const [metaImages, setMetaImages] = useState<Record<string, string | null>>({})

  useEffect(() => {
    fetch('/api/meta-ads/insights')
      .then((r) => r.ok ? r.json() : null)
      .then((json: { data?: MetaInsight[] } | null) => {
        if (!json?.data) return
        const map: Record<string, string | null> = {}
        for (const row of json.data) {
          if (row.creativeImageUrl) map[row.adName] = row.creativeImageUrl
        }
        setMetaImages(map)
      })
      .catch((err) => console.error('[AdSelector] meta-ads/insights:', err))
  }, [])

  const toggle = (name: string) => {
    onChange(
      selected.includes(name)
        ? selected.filter((n) => n !== name)
        : [...selected, name]
    )
  }

  const allChecked = ads.length > 0 && selected.length === ads.length
  const toggleAll  = () => onChange(allChecked ? [] : ads.map((a) => a.adName))

  return (
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, cursor: 'pointer', fontSize: 12, color: '#6B7280' }}>
        <input
          type="checkbox"
          checked={allChecked}
          onChange={toggleAll}
          style={{ accentColor: '#0D9488', width: 14, height: 14 }}
        />
        全広告を選択（{ads.length}件）
      </label>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 6 }}>
        {ads.map((ad) => {
          const checked = selected.includes(ad.adName)
          const imageUrl = metaImages[ad.adName] ?? ad.creativeImageUrl
          return (
            <label
              key={ad.adName}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: checked ? '2px solid #0D9488' : '1px solid #E5E7EB',
                background: checked ? 'rgba(13,148,136,.04)' : '#fff',
                cursor: 'pointer',
                minWidth: 160,
                maxWidth: 180,
                transition: 'all .12s',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggle(ad.adName)}
                  style={{ accentColor: '#0D9488', width: 14, height: 14 }}
                />
                <span style={{ fontSize: 10.5, color: checked ? '#0D9488' : '#9CA3AF', fontWeight: 500 }}>
                  {checked ? '選択中' : '未選択'}
                </span>
              </div>

              <div style={{
                width: '100%', height: 100, borderRadius: 6, overflow: 'hidden',
                background: '#F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt={ad.adName}
                    loading="lazy"
                    decoding="async"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center top', imageRendering: 'auto' }}
                  />
                ) : (
                  <span style={{ fontSize: 10, color: '#CBD5E1' }}>画像なし</span>
                )}
              </div>

              <div style={{
                fontSize: 11, fontWeight: 600, color: '#111827',
                display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
              }}>
                {ad.adName}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>
                    {ad.leads.toLocaleString()}
                  </div>
                  <div style={{ fontSize: 9.5, color: '#9CA3AF' }}>リード</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0D9488' }}>
                    {(ad.appoRate ?? 0).toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 9.5, color: '#9CA3AF' }}>アポ率</div>
                </div>
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
