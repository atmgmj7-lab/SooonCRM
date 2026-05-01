import { ListInfoTable } from '@/modules/list-info/list-info-table'
import { MOCK_LIST_INFO_ROWS } from '@/modules/list-info/mock-list-rows'

export default function ListInfoPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-[22px] font-semibold text-[var(--color-gray-900)]">リスト情報</h1>
        <p className="mt-2 text-[13px] text-[var(--color-gray-600)]">
          参照レイアウト:{' '}
          <span className="break-all font-mono text-[12px] text-[var(--color-gray-600)]">
            fm-import/screenshots/スクリーンショット 2026-04-26 11.02.48.png
          </span>
        </p>
      </div>

      <ListInfoTable rows={MOCK_LIST_INFO_ROWS} />
    </div>
  )
}
