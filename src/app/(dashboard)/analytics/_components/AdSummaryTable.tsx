'use client'
import { Fragment, useState } from 'react'
import type { AdSummaryRow } from '../_lib/types'

const APPO_BREAKDOWN_HINT =
  'クリックで内訳を表示（調整中 / 採用OK / 採用NG / 受注は appo_detail_status ベース）'

function fmtRate(n: number | null | undefined) {
  if (n == null) return '-'
  return n.toFixed(1) + '%'
}

function fmtNum(n: number | null | undefined) {
  if (n == null) return '-'
  return n.toLocaleString('ja-JP')
}

function fmtYen(n: number | null | undefined) {
  if (n == null || n === 0) return '-'
  return '¥' + n.toLocaleString('ja-JP')
}

function Th({
  label, right, sticky, group, tooltip, bold,
}: {
  label: string
  right?: boolean
  sticky?: boolean
  group?: boolean
  tooltip?: string
  bold?: boolean
}) {
  return (
    <th
      title={tooltip}
      className={right ? 'text-right' : 'text-left'}
      style={{
        padding: '7px 8px',
        fontSize: 11,
        fontWeight: bold ? 700 : 500,
        whiteSpace: 'pre-wrap',
        color: 'var(--color-gray-600)',
        background: group ? '#F0FDF4' : 'var(--color-gray-50)',
        borderBottom: '1px solid var(--color-gray-200)',
        position: sticky ? 'sticky' : undefined,
        left: sticky ? 0 : undefined,
        zIndex: sticky ? 2 : undefined,
        cursor: tooltip ? 'help' : undefined,
        minWidth: 52,
      }}
    >
      {label}
    </th>
  )
}

function Td({
  children, right, color, sticky, bold, title: titleAttr,
}: {
  children: React.ReactNode
  right?: boolean
  color?: string
  sticky?: boolean
  bold?: boolean
  title?: string
}) {
  return (
    <td
      title={titleAttr}
      className={right ? 'tabular-nums text-right' : ''}
      style={{
        padding: '6px 8px',
        fontSize: 12,
        fontWeight: bold ? 700 : undefined,
        whiteSpace: 'nowrap',
        borderBottom: '1px solid var(--color-gray-200)',
        color: color ?? 'var(--color-gray-900)',
        position: sticky ? 'sticky' : undefined,
        left: sticky ? 0 : undefined,
        background: sticky ? 'var(--color-white)' : undefined,
        zIndex: sticky ? 1 : undefined,
      }}
    >
      {children}
    </td>
  )
}

export function AdSummaryTable({ data, onExport }: { data: AdSummaryRow[]; onExport?: () => void }) {
  const [expandedApp, setExpandedApp] = useState<Set<string>>(() => new Set())

  function toggleAppo(adName: string) {
    setExpandedApp((prev) => {
      const next = new Set(prev)
      if (next.has(adName)) next.delete(adName)
      else next.add(adName)
      return next
    })
  }

  const sumN  = (k: keyof AdSummaryRow) => data.reduce((s, r) => s + ((r[k] as number) ?? 0), 0)
  const sumNullable = (k: keyof AdSummaryRow): number | null => {
    const vals = data.map((r) => r[k] as number | null).filter((v) => v != null)
    return vals.length > 0 ? (vals as number[]).reduce((s, v) => s + v, 0) : null
  }

  const tl = sumN('leads')
  const ta = sumN('appo')
  const tk = sumN('kanryo')

  const tSpend   = sumNullable('adSpend')
  const tRevenue = sumN('totalRevenue')
  const tCashflow = sumN('cashflowRevenue')
  const tClicks  = sumNullable('clicks')
  const tImpr    = sumNullable('impressions')

  const totalCalc = {
    cpa:          tSpend != null && tl > 0 ? tSpend / tl : null,
    ctr:          tSpend != null && tImpr != null && tClicks != null && tImpr > 0 ? (tClicks / tImpr) * 100 : null,
    cpc:          tSpend != null && tClicks != null && tClicks > 0 ? tSpend / tClicks : null,
    cpm:          tSpend != null && tImpr != null && tImpr > 0 ? (tSpend / tImpr) * 1000 : null,
    cpaPerAppo:   tSpend != null && ta > 0 ? tSpend / ta : null,
    roasTotal:    tSpend != null && tSpend > 0 && tRevenue > 0 ? (tRevenue / tSpend) * 100 : null,
    roasCashflow: tSpend != null && tSpend > 0 && tCashflow > 0 ? (tCashflow / tSpend) * 100 : null,
    appoRate:          tl > 0 ? (ta / tl) * 100 : null,
    appoRateKanryo:    tk > 0 ? (ta / tk) * 100 : null,
    kanryoRate:        tl > 0 ? (tk / tl) * 100 : null,
  }

  const listColCount = 12
  const rateColCount = 3
  const adColCount   = 11

  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
      <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--color-gray-200)' }}>
        <p className="text-[13px] font-semibold" style={{ color: 'var(--color-gray-900)' }}>広告別サマリー</p>
        {onExport && (
          <button
            type="button"
            onClick={onExport}
            className="rounded-lg px-3 py-1.5 text-[12px] font-medium border"
            style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)', color: 'var(--color-gray-700)' }}
          >
            CSV エクスポート
          </button>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table className="border-collapse" style={{ minWidth: 2000 }}>
          <thead>
            <tr>
              <th rowSpan={2} style={{ padding: '7px 8px', fontSize: 11, fontWeight: 500, background: 'var(--color-gray-50)', borderBottom: '1px solid var(--color-gray-200)', position: 'sticky', left: 0, zIndex: 3, whiteSpace: 'nowrap' }}>
                広告名
              </th>
              <th colSpan={listColCount} style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, background: '#F0FDF4', borderBottom: '1px solid var(--color-gray-200)', borderLeft: '2px solid #BBF7D0', textAlign: 'center', color: '#065F46' }}>
                リスト集計
              </th>
              <th colSpan={rateColCount} style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, background: '#EFF6FF', borderBottom: '1px solid var(--color-gray-200)', borderLeft: '2px solid #BFDBFE', textAlign: 'center', color: '#1E40AF' }}>
                率指標
              </th>
              <th colSpan={adColCount} style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, background: '#FFF7ED', borderBottom: '1px solid var(--color-gray-200)', borderLeft: '2px solid #FED7AA', textAlign: 'center', color: '#92400E' }}>
                広告指標
              </th>
            </tr>
            <tr>
              <Th label="リスト数" right group />
              <Th label="アポOK" right group bold tooltip={APPO_BREAKDOWN_HINT} />
              <Th label="NG" right group />
              <Th label="対象外" right group tooltip="対象外・ポータル・現アナ・重複を含む" />
              <Th label="重複" right group />
              <Th label="完了" right group bold tooltip="アポOK＋NG＋対象外＋現アナ＋ポータル＋重複＋改め＋未対応" />
              <Th label="新規" right group />
              <Th label="留守" right group />
              <Th label="見込みA" right group />
              <Th label="見込みB" right group />
              <Th label="見込みC" right group />
              <Th label="未完了" right group bold tooltip="新規＋留守＋見込みA/B/C" />
              <Th label={"対リスト\nアポ率"} right tooltip="リード数に対するアポOKの割合" />
              <Th label={"対完了\nアポ率"} right tooltip="完了数に対するアポOKの割合" />
              <Th label="完了率" right tooltip="リード数に対する完了の割合" />
              <Th label="クリック" right />
              <Th label="リーチ" right />
              <Th label="インプ" right />
              <Th label={"CPA\n1L単価"} right tooltip="広告費 ÷ リード数（1リスト獲得コスト）" />
              <Th label="CTR" right tooltip="クリック数 ÷ インプレッション × 100" />
              <Th label="CPC" right tooltip="広告費 ÷ クリック数" />
              <Th label="CPM" right tooltip="広告費 ÷ インプレッション × 1000" />
              <Th label="広告費" right bold />
              <Th label="1A単価" right tooltip="広告費 ÷ アポOK数" />
              <Th label="総受注額" right bold />
              <Th label={"総受注\nROAS"} right bold tooltip="総受注額 ÷ 広告費 × 100" />
              <Th label={"入金額\nROAS"} right tooltip="(初期費用+月額費用) ÷ 広告費 × 100。leads.initial_fee と leads.monthly_fee を参照" />
            </tr>
          </thead>
          <tbody>
            {data.length === 0 && (
              <tr>
                <td colSpan={1 + listColCount + rateColCount + adColCount} className="py-12 text-center text-[13px]" style={{ color: 'var(--color-gray-400)' }}>
                  データがありません
                </td>
              </tr>
            )}
            {data.map((row) => (
              <Fragment key={row.adName}>
              <tr
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--color-gray-50)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Td sticky>{row.adName}</Td>
                <Td right>{fmtNum(row.leads)}</Td>
                <Td
                  right
                  bold
                  color={row.appo > 0 ? 'var(--color-success)' : undefined}
                  title={APPO_BREAKDOWN_HINT}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleAppo(row.adName)
                    }}
                    className="tabular-nums w-full text-right underline-offset-2 hover:underline"
                    style={{
                      cursor: row.appo > 0 ? 'pointer' : 'default',
                      color: row.appo > 0 ? 'var(--color-success)' : 'inherit',
                      background: 'none',
                      border: 'none',
                      font: 'inherit',
                      fontWeight: 700,
                      padding: 0,
                    }}
                    aria-expanded={expandedApp.has(row.adName)}
                  >
                    {fmtNum(row.appo)}
                  </button>
                </Td>
                <Td right>{fmtNum(row.ng)}</Td>
                <Td right>{fmtNum(row.taishogai)}</Td>
                <Td right>{fmtNum(row.duplicateCount)}</Td>
                <Td right bold>{fmtNum(row.kanryo)}</Td>
                <Td right>{fmtNum(row.miCall)}</Td>
                <Td right>{fmtNum(row.rusu)}</Td>
                <Td right>{fmtNum(row.mikomiA)}</Td>
                <Td right>{fmtNum(row.mikomiB)}</Td>
                <Td right>{fmtNum(row.mikomiC)}</Td>
                <Td right bold>{fmtNum(row.mikanryo)}</Td>
                <Td right color={(row.appoRate ?? 0) >= 20 ? 'var(--color-blue)' : undefined}>{fmtRate(row.appoRate)}</Td>
                <Td right>{fmtRate(row.appoRateKanryo)}</Td>
                <Td right>{fmtRate(row.kanryoRate)}</Td>
                <Td right>{fmtNum(row.clicks)}</Td>
                <Td right>{fmtNum(row.reach)}</Td>
                <Td right>{fmtNum(row.impressions)}</Td>
                <Td right>{fmtYen(row.cpa)}</Td>
                <Td right>{fmtRate(row.ctr)}</Td>
                <Td right>{fmtYen(row.cpc)}</Td>
                <Td right>{fmtYen(row.cpm)}</Td>
                <Td right bold>{fmtYen(row.adSpend)}</Td>
                <Td right>{fmtYen(row.cpaPerAppo)}</Td>
                <Td right bold color={row.totalRevenue > 0 ? 'var(--color-success)' : undefined}>{row.totalRevenue > 0 ? fmtYen(row.totalRevenue) : '-'}</Td>
                <Td right bold color={row.roasTotal != null ? 'var(--color-success)' : undefined}>{fmtRate(row.roasTotal)}</Td>
                <Td right color={row.roasCashflow != null ? 'var(--color-success)' : undefined}>{fmtRate(row.roasCashflow)}</Td>
              </tr>
              {expandedApp.has(row.adName) && (
                <tr style={{ background: 'var(--color-blue-light)' }}>
                  <td
                    colSpan={1 + listColCount + rateColCount + adColCount}
                    style={{
                      padding: '8px 12px',
                      fontSize: 12,
                      borderBottom: '1px solid var(--color-gray-200)',
                      color: 'var(--color-gray-900)',
                    }}
                  >
                    <span className="font-semibold" style={{ color: 'var(--color-blue)' }}>
                      アポOK内訳
                    </span>
                    <span className="ml-6 tabular-nums">調整中: {fmtNum(row.chosei)}</span>
                    <span className="ml-6 tabular-nums">採用OK: {fmtNum(row.saiyoOk)}</span>
                    <span className="ml-6 tabular-nums">採用NG: {fmtNum(row.saiyoNg)}</span>
                    <span className="ml-6 tabular-nums">受注: {fmtNum(row.juchu)}</span>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
            {/* 合計行 */}
            {data.length > 0 && (
              <tr style={{ background: 'var(--color-gray-50)', fontWeight: 600 }}>
                <td style={{ padding: '6px 8px', fontSize: 12, borderTop: '2px solid var(--color-gray-300)', position: 'sticky', left: 0, background: 'var(--color-gray-50)', zIndex: 1 }}>合計</td>
                {[
                  fmtNum(tl),
                  fmtNum(sumN('appo')),
                  fmtNum(sumN('ng')),
                  fmtNum(sumN('taishogai')),
                  fmtNum(sumN('duplicateCount')),
                  fmtNum(tk),
                  fmtNum(sumN('miCall')),
                  fmtNum(sumN('rusu')),
                  fmtNum(sumN('mikomiA')),
                  fmtNum(sumN('mikomiB')),
                  fmtNum(sumN('mikomiC')),
                  fmtNum(sumN('mikanryo')),
                  fmtRate(totalCalc.appoRate),
                  fmtRate(totalCalc.appoRateKanryo),
                  fmtRate(totalCalc.kanryoRate),
                  fmtNum(sumNullable('clicks')),
                  fmtNum(sumNullable('reach')),
                  fmtNum(sumNullable('impressions')),
                  fmtYen(totalCalc.cpa),
                  fmtRate(totalCalc.ctr),
                  fmtYen(totalCalc.cpc),
                  fmtYen(totalCalc.cpm),
                  fmtYen(tSpend),
                  fmtYen(totalCalc.cpaPerAppo),
                  tRevenue > 0 ? fmtYen(tRevenue) : '-',
                  fmtRate(totalCalc.roasTotal),
                  fmtRate(totalCalc.roasCashflow),
                ].map((v, i) => (
                  <td key={i} className="tabular-nums text-right" style={{ padding: '6px 8px', fontSize: 12, borderTop: '2px solid var(--color-gray-300)', color: 'var(--color-gray-900)' }}>
                    {v}
                  </td>
                ))}
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
