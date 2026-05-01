/** FM「リスト情報」相当の一覧行（スプレッドシート準拠）。参照: fm-import/screenshots/スクリーンショット 2026-04-26 11.02.48.png */

export type ListInfoPlatformTab =
  | 'all'
  | 'meta'
  | 'google'
  | 'other'

export type ListInfoRow = {
  /** leads.id — 行クリックで /leads/[id] */
  leadId: string
  platform: Exclude<ListInfoPlatformTab, 'all'>
  inquiryAtPrimary: string
  adName: string
  companyName: string
  jobTitle: string
  representativeName: string
  prefecture: string
  inquiryAtSecondary: string | null
  email: string | null
  /** 強調表示（スクリーンショットの電話列の赤字セル相当） */
  phoneHighlight: boolean
  phone: string | null
  detailNote: string | null
  cityWard: string | null
  /** 最終架電結果 — status_definitions と整合させる前提 */
  finalCallResult: string
  completionProgress: string | null
  callCount: number
  recallDate: string | null
  recallTime: string | null
}
