'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { filterListInfoRows } from './filter-rows'
import type { ListInfoPlatformTab, ListInfoRow } from './list-info-types'

const TABS: { id: ListInfoPlatformTab; label: string }[] = [
  { id: 'all', label: '全体' },
  { id: 'meta', label: 'Meta' },
  { id: 'google', label: 'Google' },
  { id: 'other', label: 'その他' },
]

type Props = {
  rows: ListInfoRow[]
}

/**
 * FM スプレッドシート「リスト情報」風テーブル。
 * 行クリックでリード詳細（/leads/[id]）へ遷移 — リスト情報レイアウトからのドリルダウンに相当。
 *
 * Facebook カスタムオーディエンス / 再FM反映の「リスト追加」は API・キュー設計が未確定のため未実装。
 * 接続時は fm_sync_queue（REQUIREMENTS §11）や Meta Marketing API を想定。
 */
export function ListInfoTable({ rows }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<ListInfoPlatformTab>('all')

  const filtered = useMemo(() => filterListInfoRows(rows, tab), [rows, tab])

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {TABS.map(({ id, label }) => {
          const active = tab === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                'rounded-lg px-3 py-2 text-[13px] font-medium transition-colors duration-150',
                active
                  ? 'bg-[var(--color-blue)] text-white'
                  : 'border border-[var(--color-gray-200)] bg-[var(--color-white)] text-[var(--color-gray-600)] hover:bg-[var(--color-gray-50)]',
              ].join(' ')}
            >
              {label}
            </button>
          )
        })}
      </div>

      <div
        className="overflow-x-auto rounded-xl border border-[var(--color-gray-200)] bg-[var(--color-white)]"
        style={{ maxWidth: '100%' }}
      >
        <table className="w-full min-w-[1200px] border-collapse text-left text-[13px]">
          <thead>
            <tr
              className="text-[12px] font-semibold text-[var(--color-white)]"
              style={{ backgroundColor: 'var(--color-navy-mid)' }}
            >
              <th className="whitespace-nowrap px-3 py-2 font-medium">問い合わせ日</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">広告名</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">会社名</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">役職</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">代表名</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">県名</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">問い合わせ日②</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">メール</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">電話番号(81変換)</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">詳細</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">市区</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">最終架電結果</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">完了進捗</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium tabular-nums">コール数</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">再日</th>
              <th className="whitespace-nowrap px-3 py-2 font-medium">再時間</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={16} className="px-3 py-8 text-center text-[var(--color-gray-600)]">
                  該当する行がありません。
                </td>
              </tr>
            ) : (
              filtered.map((row, idx) => {
                const zebra = idx % 2 === 0 ? 'var(--color-gray-50)' : 'var(--color-white)'
                const statusWarm =
                  row.finalCallResult.includes('留守') || row.finalCallResult.includes('留守番')
                    ? 'bg-[var(--color-warning-bg)]'
                    : ''

                return (
                  <tr
                    key={row.leadId}
                    role="link"
                    tabIndex={0}
                    onClick={() => router.push(`/leads/${row.leadId}`)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        router.push(`/leads/${row.leadId}`)
                      }
                    }}
                    className="cursor-pointer border-b border-[var(--color-gray-200)] transition-colors duration-150 hover:bg-[var(--color-gray-100)]"
                    style={{ backgroundColor: zebra }}
                  >
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--color-gray-900)]">
                      {row.inquiryAtPrimary}
                    </td>
                    <td className="max-w-[200px] truncate px-3 py-2">{row.adName}</td>
                    <td className="max-w-[140px] truncate px-3 py-2 font-medium">{row.companyName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.jobTitle}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.representativeName}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.prefecture}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums text-[var(--color-gray-600)]">
                      {row.inquiryAtSecondary ?? '—'}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-[var(--color-gray-600)]">
                      {row.email ?? '—'}
                    </td>
                    <td
                      className={[
                        'whitespace-nowrap px-3 py-2 tabular-nums',
                        row.phoneHighlight ? 'bg-[var(--color-danger-bg)] text-[var(--color-danger)]' : '',
                      ].join(' ')}
                    >
                      {row.phone ?? '—'}
                    </td>
                    <td className="max-w-[160px] truncate px-3 py-2 text-[var(--color-gray-600)]">
                      {row.detailNote ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-[var(--color-gray-600)]">
                      {row.cityWard ?? '—'}
                    </td>
                    <td
                      className={[
                        'whitespace-nowrap px-3 py-2',
                        statusWarm,
                        !statusWarm ? 'text-[var(--color-gray-900)]' : '',
                      ].join(' ')}
                    >
                      {row.finalCallResult}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2">{row.completionProgress ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{row.callCount}</td>
                    <td className="whitespace-nowrap px-3 py-2">{row.recallDate ?? '—'}</td>
                    <td className="whitespace-nowrap px-3 py-2 tabular-nums">{row.recallTime ?? '—'}</td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[12px] text-[var(--color-gray-600)]">
        行をクリックするとリード詳細（リスト情報レコード相当）へ移動します。
      </p>
    </div>
  )
}
