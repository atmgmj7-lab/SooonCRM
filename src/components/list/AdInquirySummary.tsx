'use client'

type Lead = {
  id: string
  ad_name: string | null
  inquiry_date: string | null
  inquiry_at: string | null
  status: string | null
}

type AdGroup = {
  adName: string
  count: number
  latestDate: string | null
  statusCounts: Record<string, number>
}

function groupByAd(leads: Lead[], fallbackAdName: string | null): AdGroup[] {
  const map = new Map<string, AdGroup>()

  for (const lead of leads) {
    const key = lead.ad_name ?? fallbackAdName ?? '（広告名なし）'
    const existing = map.get(key)
    const date = lead.inquiry_at ?? lead.inquiry_date ?? null

    if (existing) {
      existing.count++
      if (date && (!existing.latestDate || date > existing.latestDate)) {
        existing.latestDate = date
      }
      if (lead.status) {
        existing.statusCounts[lead.status] = (existing.statusCounts[lead.status] ?? 0) + 1
      }
    } else {
      map.set(key, {
        adName:       key,
        count:        1,
        latestDate:   date,
        statusCounts: lead.status ? { [lead.status]: 1 } : {},
      })
    }
  }

  return [...map.values()].sort((a, b) => b.count - a.count)
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  '新規':   { bg: 'var(--color-blue-light)',   color: 'var(--color-blue)' },
  'アポOK': { bg: 'var(--color-success-bg)',   color: 'var(--color-success)' },
  'NG':     { bg: 'var(--color-danger-bg)',    color: 'var(--color-danger)' },
  '受注':   { bg: '#FFF7ED',                   color: '#EA580C' },
  '留守':   { bg: 'var(--color-gray-100)',      color: 'var(--color-gray-600)' },
  '保留':   { bg: 'var(--color-warning-bg)',   color: 'var(--color-warning)' },
}

function StatusBadge({ status, count }: { status: string; count: number }) {
  const c = STATUS_COLORS[status] ?? { bg: 'var(--color-gray-100)', color: 'var(--color-gray-600)' }
  return (
    <span style={{
      fontSize: 10,
      fontWeight: 600,
      padding: '1px 6px',
      borderRadius: 9999,
      background: c.bg,
      color: c.color,
      display: 'inline-flex',
      alignItems: 'center',
      gap: 2,
    }}>
      {status} <span style={{ opacity: 0.8 }}>×{count}</span>
    </span>
  )
}

export function AdInquirySummary({
  leads,
  fallbackAdName,
}: {
  leads: Lead[]
  fallbackAdName: string | null
}) {
  if (leads.length === 0) return null

  const groups = groupByAd(leads, fallbackAdName)

  return (
    <div style={{
      background: 'var(--color-white)',
      border: '1px solid var(--color-gray-200)',
      borderRadius: 8,
      overflow: 'hidden',
      marginBottom: 12,
    }}>
      {/* ヘッダ */}
      <div style={{
        padding: '8px 12px',
        background: 'var(--color-gray-50)',
        borderBottom: '1px solid var(--color-gray-200)',
        fontSize: 11,
        fontWeight: 700,
        color: 'var(--color-gray-600)',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}>
        広告別 問い合わせ集計
        <span style={{
          fontSize: 10,
          fontWeight: 400,
          background: 'var(--color-gray-200)',
          color: 'var(--color-gray-600)',
          padding: '0 5px',
          borderRadius: 9999,
        }}>
          {leads.length}件
        </span>
      </div>

      {/* グループ行 */}
      {groups.map((g, i) => (
        <div
          key={g.adName}
          style={{
            padding: '10px 12px',
            borderTop: i > 0 ? '1px solid var(--color-gray-100)' : 'none',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
          }}
        >
          {/* 広告名 + 件数 */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--color-gray-900)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 220,
              }}>
                {g.adName}
              </span>
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: 'var(--color-blue)',
                background: 'var(--color-blue-light)',
                padding: '1px 8px',
                borderRadius: 9999,
                flexShrink: 0,
              }}>
                {g.count}件
              </span>
            </div>
            {/* ステータス内訳 */}
            {Object.entries(g.statusCounts).length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {Object.entries(g.statusCounts).map(([s, n]) => (
                  <StatusBadge key={s} status={s} count={n} />
                ))}
              </div>
            )}
          </div>
          {/* 最終問い合わせ日 */}
          {g.latestDate && (
            <div style={{ flexShrink: 0, textAlign: 'right' }}>
              <div style={{ fontSize: 9.5, color: 'var(--color-gray-400)' }}>最終</div>
              <div style={{ fontSize: 11, color: 'var(--color-gray-600)', fontVariantNumeric: 'tabular-nums' }}>
                {g.latestDate.slice(0, 10)}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
