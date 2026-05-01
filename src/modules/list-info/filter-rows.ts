import type { ListInfoPlatformTab, ListInfoRow } from './list-info-types'

/** JST として解釈される前提の下限（製品要件で固定されている場合は RPC 側と合わせる） */
const INQUIRY_NOT_BEFORE = new Date('2026-05-31T15:00:00.000Z') // 2026-06-01 00:00 JST

export function filterListInfoRows(
  rows: ListInfoRow[],
  tab: ListInfoPlatformTab
): ListInfoRow[] {
  let out = rows.filter((r) => {
    const t = new Date(r.inquiryAtPrimary.replace(' ', 'T'))
    return !Number.isNaN(t.getTime()) && t >= INQUIRY_NOT_BEFORE
  })

  if (tab !== 'all') {
    out = out.filter((r) => r.platform === tab)
  }

  return out
}
