'use client'

import { useState, useCallback, useRef } from 'react'

const DEFAULT_MAPPING: Record<string, string> = {
  '問い合わせ日': 'inquiry_date',
  '広告名': 'ad_name',
  '会社名': 'company_name',
  '役職': 'rep_title',
  '代表名': 'representative_name',
  '県名': 'prefecture',
  '電話番号': 'phone_number',
  'phone_number': 'phone_number',
  'メール': 'email_address',
  '詳細': 'lead_detail',
  '最終架電結果': 'last_call_result',
  'コール数': 'call_count',
  '再日': 'recall_date',
  '再時間': 'recall_time',
  '実用O': 'jitsuyo_ok',
  '1用N': 'ichiyou_ng',
  '受注': 'order_closed',
  '初期': 'initial_fee',
  '月額': 'monthly_fee',
  '契約月数': 'contract_months',
  '総受注額': 'total_revenue',
}

const DB_FIELD_OPTIONS = [
  { value: '', label: '（無視）' },
  { value: 'inquiry_date', label: '問い合わせ日' },
  { value: 'ad_name', label: '広告名' },
  { value: 'company_name', label: '会社名' },
  { value: 'rep_title', label: '役職' },
  { value: 'representative_name', label: '代表名' },
  { value: 'prefecture', label: '県名' },
  { value: 'phone_number', label: '電話番号' },
  { value: 'email_address', label: 'メール' },
  { value: 'lead_detail', label: '詳細' },
  { value: 'last_call_result', label: '最終架電結果' },
  { value: 'call_count', label: 'コール数' },
  { value: 'recall_date', label: '再コール日' },
  { value: 'recall_time', label: '再コール時間' },
  { value: 'jitsuyo_ok', label: '実用OK' },
  { value: 'ichiyou_ng', label: '一用NG' },
  { value: 'order_closed', label: '受注' },
  { value: 'initial_fee', label: '初期費用' },
  { value: 'monthly_fee', label: '月額' },
  { value: 'contract_months', label: '契約月数' },
  { value: 'total_revenue', label: '総受注額' },
]

const CHUNK = 500

export default function ImportLeadsPage() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (!f) return
    setResult(null)
    setError(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(Boolean)
      if (lines.length < 2) { setError('CSVに行がありません'); return }

      function parseLine(line: string): string[] {
        const cells: string[] = []
        let cur = ''
        let inQuote = false
        for (let i = 0; i < line.length; i++) {
          const c = line[i]
          if (inQuote) {
            if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
            else if (c === '"') inQuote = false
            else cur += c
          } else {
            if (c === '"') inQuote = true
            else if (c === ',') { cells.push(cur); cur = '' }
            else cur += c
          }
        }
        cells.push(cur)
        return cells
      }

      const parsedHeaders = parseLine(lines[0]).map(h => h.trim())
      setHeaders(parsedHeaders)

      const dataRows = lines.slice(1).map(line => {
        const values = parseLine(line)
        const obj: Record<string, string> = {}
        parsedHeaders.forEach((h, i) => { obj[h] = (values[i] ?? '').trim() })
        return obj
      })
      setRows(dataRows)

      const autoMapping: Record<string, string> = {}
      parsedHeaders.forEach(h => {
        if (DEFAULT_MAPPING[h]) autoMapping[h] = DEFAULT_MAPPING[h]
      })
      setMapping(autoMapping)
    }
    reader.readAsText(f, 'UTF-8')
  }, [])

  const handleImport = useCallback(async () => {
    if (rows.length === 0 || importing) return
    setImporting(true)
    setProgress(0)
    setResult(null)
    setError(null)

    const mappedRows = rows.map(row => {
      const mapped: Record<string, string> = {}
      Object.entries(mapping).forEach(([csvCol, dbCol]) => {
        if (dbCol) mapped[dbCol] = row[csvCol] ?? ''
      })
      return mapped
    })

    let totalImported = 0
    let totalSkipped = 0

    for (let i = 0; i < mappedRows.length; i += CHUNK) {
      const chunk = mappedRows.slice(i, i + CHUNK)

      try {
        const res = await fetch('/api/admin/import-leads', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk }),
        })

        if (!res.ok) {
          const errText = await res.text()
          console.error('[import] API error:', res.status, errText)
          setError(`APIエラー: ${res.status}`)
          break
        }

        const data = await res.json() as { imported?: number; skipped?: number; error?: string }
        totalImported += data.imported ?? 0
        totalSkipped += data.skipped ?? 0
        if (data.error) {
          console.error('[import] API returned error:', data.error)
          setError(`DBエラー: ${data.error}`)
          break
        }
      } catch (e) {
        console.error('[import] fetch error:', e)
        setError('通信エラーが発生しました')
        break
      }

      setProgress(Math.round(Math.min(i + CHUNK, mappedRows.length) / mappedRows.length * 100))
    }

    setResult({ imported: totalImported, skipped: totalSkipped })
    setImporting(false)
  }, [rows, mapping, importing])

  return (
    <div style={{ padding: 32, maxWidth: 1000 }}>
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: 'var(--color-gray-900)' }}>
        CSVインポート
      </h1>

      {/* ファイル選択 */}
      <div style={{ marginBottom: 24 }}>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          style={{ display: 'block', marginBottom: 8, fontSize: 13 }}
        />
        {rows.length > 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-gray-600)' }}>
            {rows.length}行 読み込み済み
          </p>
        )}
      </div>

      {/* 列マッピング */}
      {headers.length > 0 && (
        <div style={{ marginBottom: 24, border: '1px solid var(--color-gray-200)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: 'var(--color-gray-50)', padding: '10px 16px', fontSize: 13, fontWeight: 600, color: 'var(--color-gray-900)' }}>
            列マッピング
          </div>
          <div style={{ padding: 16, display: 'flex', flexWrap: 'wrap', gap: '8px 24px' }}>
            {headers.map(h => (
              <label key={h} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--color-gray-700)' }}>
                <span style={{ fontWeight: 500 }}>{h}</span>
                <select
                  value={mapping[h] ?? ''}
                  onChange={e => setMapping(prev => ({ ...prev, [h]: e.target.value }))}
                  style={{ fontSize: 12, borderRadius: 4, border: '1px solid var(--color-gray-200)', padding: '2px 6px', color: 'var(--color-gray-900)' }}
                >
                  {DB_FIELD_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* プレビュー（先頭5行） */}
      {rows.length > 0 && (
        <div style={{ marginBottom: 24, overflowX: 'auto', border: '1px solid var(--color-gray-200)', borderRadius: 8 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--color-gray-50)' }}>
                {headers.slice(0, 8).map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid var(--color-gray-200)', color: 'var(--color-gray-600)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((row, i) => (
                <tr key={i} style={{ borderBottom: '1px solid var(--color-gray-200)' }}>
                  {headers.slice(0, 8).map(h => (
                    <td key={h} style={{ padding: '6px 12px', color: 'var(--color-gray-700)', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row[h]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 進捗バー */}
      {importing && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ background: 'var(--color-gray-100)', borderRadius: 8, height: 8 }}>
            <div style={{ background: 'var(--color-blue)', borderRadius: 8, height: 8, width: `${progress}%`, transition: 'width 0.3s' }} />
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-gray-400)', marginTop: 4 }}>インポート中… {progress}%</p>
        </div>
      )}

      {/* エラー */}
      {error && (
        <div style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '10px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* 結果 */}
      {result && (
        <div style={{
          background: result.imported > 0 ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
          color: result.imported > 0 ? 'var(--color-success)' : 'var(--color-warning)',
          padding: '10px 16px', borderRadius: 8, fontSize: 13, marginBottom: 16,
        }}>
          {result.imported}件インポート完了
          {result.skipped > 0 && `、${result.skipped}件スキップ`}
        </div>
      )}

      {/* インポートボタン */}
      {rows.length > 0 && (
        <button
          type="button"
          onClick={handleImport}
          disabled={importing}
          style={{
            background: importing ? 'var(--color-gray-400)' : 'var(--color-blue)',
            color: '#fff',
            border: 'none',
            padding: '12px 32px',
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 600,
            cursor: importing ? 'not-allowed' : 'pointer',
          }}
        >
          {importing ? 'インポート中...' : `インポート実行（${rows.length}件）`}
        </button>
      )}
    </div>
  )
}
