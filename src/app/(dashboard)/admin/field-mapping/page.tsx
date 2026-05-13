'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  FM_FIELDS_LIST_RECORDS,
  FM_FIELDS_CALLS,
  SUPABASE_COLS_LIST_RECORDS,
  SUPABASE_COLS_CALLS,
  type FmField,
} from '@/lib/constants/fm-fields'

type Mapping = {
  source_field: string
  target_field: string
  target_table: string
  label_ja: string
  enabled: boolean
}

type TabKey = 'list_records' | 'calls'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'list_records', label: 'リスト情報（list_records）' },
  { key: 'calls',        label: 'コール履歴（calls）' },
]

// FM フィールドのサンプル値（プレビュー用）
const FM_SAMPLE_VALUES: Record<string, string> = {
  '顧客ID':           'CS0140436',
  'ADNAME':           'テスト広告_外壁塗装',
  'リスト譲渡日':     '2025/06/22',
  'リスト':           '金額表示_ポップ',
  '業種':             'インバウンド',
  '新人フラグ':       '谷川 聖斗',
  'リスト作成日時':   '2025/06/22 19:42:41',
  '会社名':           '村上工業',
  '代表名':           '村上浩太',
  '役職':             '代表取締役',
  '都道府県':         '福岡県',
  '電話番号':         '0952-80-0503',
  'メールアドレス':   'test@example.com',
  '住所':             '福岡県佐賀市',
  '再コール日':       '2025/07/01',
  'リスト精査':       'ゲキアツ',
  'ホームページURL':  'https://example.com',
  'MEO':              '未対策',
  '案件メモ':         '折り返し希望',
  '最終コール結果':   'アポOK',
  'コール結果':       'アポOK',
  'コール開始日':     '2025/06/23',
  'コール開始時刻':   '16:25',
  '担当者名':         '谷川 聖斗',
  'リストレベル':     '受付',
  '代表レベル':       'アポOK',
}

function buildDefaultMappings(fmFields: FmField[], table: TabKey): Mapping[] {
  return fmFields.map((f) => ({
    source_field: f.key,
    target_field: '',
    target_table: table,
    label_ja:     f.label,
    enabled:      true,
  }))
}

export default function FieldMappingPage() {
  const [tab, setTab] = useState<TabKey>('list_records')
  const [mappings, setMappings] = useState<Record<TabKey, Mapping[]>>({
    list_records: buildDefaultMappings(FM_FIELDS_LIST_RECORDS, 'list_records'),
    calls:        buildDefaultMappings(FM_FIELDS_CALLS, 'calls'),
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hoveredCol, setHoveredCol] = useState<string | null>(null)

  const loadMappings = useCallback(async (table: TabKey) => {
    try {
      const res = await fetch(`/api/admin/field-mappings?table=${table}`)
      const json = await res.json()
      if (!res.ok) return
      const stored: Mapping[] = json.mappings ?? []
      if (stored.length === 0) return

      const fmFields = table === 'list_records' ? FM_FIELDS_LIST_RECORDS : FM_FIELDS_CALLS
      const merged = buildDefaultMappings(fmFields, table).map((def) => {
        const hit = stored.find(
          (s) => s.source_field === def.source_field && s.target_table === table,
        )
        return hit
          ? { ...def, target_field: hit.target_field, label_ja: hit.label_ja ?? def.label_ja, enabled: hit.enabled }
          : def
      })
      setMappings((prev) => ({ ...prev, [table]: merged }))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadMappings('list_records')
    loadMappings('calls')
  }, [loadMappings])

  const updateRow = (table: TabKey, idx: number, field: Partial<Mapping>) => {
    setMappings((prev) => {
      const rows = [...prev[table]]
      rows[idx] = { ...rows[idx], ...field }
      return { ...prev, [table]: rows }
    })
  }

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError(null)
    try {
      const toSave = mappings[tab].filter((m) => m.target_field !== '')
      const res = await fetch('/api/admin/field-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: toSave }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? '保存失敗'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e) {
      setError(String(e))
    } finally {
      setSaving(false)
    }
  }

  const fmFields  = tab === 'list_records' ? FM_FIELDS_LIST_RECORDS : FM_FIELDS_CALLS
  const sbCols    = tab === 'list_records' ? SUPABASE_COLS_LIST_RECORDS : SUPABASE_COLS_CALLS
  const rows      = mappings[tab]

  // プレビュー: 現在のマッピングで Supabase に入るデータ
  const previewData = rows
    .filter(r => r.target_field !== '' && r.enabled)
    .map(r => ({
      sbCol:     r.target_field,
      sbLabel:   sbCols.find(c => c.key === r.target_field)?.label ?? r.target_field,
      fmField:   r.source_field,
      sampleVal: FM_SAMPLE_VALUES[r.source_field] ?? '（値なし）',
    }))

  return (
    <div style={{ padding: '24px', display: 'flex', gap: 24, alignItems: 'flex-start', maxWidth: 1300 }}>
      {/* ─── 左：マッピング設定 ─── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ marginBottom: 16 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: 4 }}>
            フィールドマッピング
          </h1>
          <p style={{ fontSize: 12, color: 'var(--color-gray-400)' }}>
            FileMakerのフィールド名とSupabaseのカラム名の対応を設定します。
          </p>
        </div>

        {/* タブ */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--color-gray-200)' }}>
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              style={{
                padding: '8px 16px',
                fontSize: 12.5,
                fontWeight: tab === t.key ? 600 : 400,
                color: tab === t.key ? 'var(--color-blue)' : 'var(--color-gray-600)',
                borderBottom: tab === t.key ? '2px solid var(--color-blue)' : '2px solid transparent',
                background: 'none',
                border: 'none',
                borderBottomStyle: 'solid',
                cursor: 'pointer',
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* テーブルヘッダ */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 60px',
          gap: 8,
          padding: '8px 12px',
          background: 'var(--color-gray-50)',
          borderRadius: '8px 8px 0 0',
          border: '1px solid var(--color-gray-200)',
          borderBottom: 'none',
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-gray-600)',
        }}>
          <span>FMフィールド名</span>
          <span>Supabaseカラム</span>
          <span style={{ textAlign: 'center' }}>有効</span>
        </div>

        {/* 行 */}
        <div style={{ border: '1px solid var(--color-gray-200)', borderRadius: '0 0 8px 8px', overflow: 'hidden', maxHeight: 600, overflowY: 'auto' }}>
          {fmFields.map((fm, idx) => {
            const row = rows[idx]
            const isHighlighted = hoveredCol !== null && row?.target_field === hoveredCol
            return (
              <div
                key={fm.key}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 60px',
                  gap: 8,
                  padding: '9px 12px',
                  alignItems: 'center',
                  borderTop: idx > 0 ? '1px solid var(--color-gray-100)' : 'none',
                  background: isHighlighted
                    ? 'rgba(37,99,235,.06)'
                    : row?.enabled === false ? 'var(--color-gray-50)' : 'var(--color-white)',
                  transition: 'background .12s',
                }}
              >
                {/* FMフィールド */}
                <div>
                  <div style={{ fontSize: 12.5, color: 'var(--color-gray-900)', fontWeight: 500 }}>{fm.key}</div>
                  {fm.label !== fm.key && (
                    <div style={{ fontSize: 10.5, color: 'var(--color-gray-400)', marginTop: 1 }}>{fm.label}</div>
                  )}
                  {FM_SAMPLE_VALUES[fm.key] && (
                    <div style={{ fontSize: 10, color: 'var(--color-gray-400)', marginTop: 1, fontStyle: 'italic' }}>
                      例: {FM_SAMPLE_VALUES[fm.key]}
                    </div>
                  )}
                </div>

                {/* Supabaseカラム select */}
                <select
                  value={row?.target_field ?? ''}
                  onChange={(e) => updateRow(tab, idx, { target_field: e.target.value })}
                  onFocus={(e) => setHoveredCol(e.target.value || null)}
                  onBlur={() => setHoveredCol(null)}
                  style={{
                    width: '100%',
                    fontSize: 12,
                    padding: '5px 8px',
                    border: `1px solid ${row?.target_field ? 'var(--color-blue)' : 'var(--color-gray-200)'}`,
                    borderRadius: 6,
                    background: 'var(--color-white)',
                    color: 'var(--color-gray-900)',
                    outline: 'none',
                  }}
                >
                  <option value="">— 未割当 —</option>
                  {sbCols.map((col) => (
                    <option key={col.key} value={col.key}>
                      {col.key}（{col.label}）
                    </option>
                  ))}
                </select>

                {/* 有効トグル */}
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  <input
                    type="checkbox"
                    checked={row?.enabled ?? true}
                    onChange={(e) => updateRow(tab, idx, { enabled: e.target.checked })}
                    style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--color-blue)' }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* 保存ボタン */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            style={{
              padding: '8px 24px',
              fontSize: 13,
              fontWeight: 600,
              background: saving ? 'var(--color-gray-200)' : 'var(--color-blue)',
              color: saving ? 'var(--color-gray-600)' : 'var(--color-white)',
              border: 'none',
              borderRadius: 8,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            {saving ? '保存中...' : '保存'}
          </button>
          {saved && <span style={{ fontSize: 12, color: 'var(--color-success)' }}>保存しました</span>}
          {error && <span style={{ fontSize: 12, color: 'var(--color-danger)' }}>{error}</span>}
          <span style={{ fontSize: 11, color: 'var(--color-gray-400)', marginLeft: 'auto' }}>
            {rows.filter(r => r.target_field).length} / {fmFields.length} 割当済み
          </span>
        </div>
      </div>

      {/* ─── 右：プレビューパネル ─── */}
      <div style={{ width: 320, flexShrink: 0, position: 'sticky', top: 24 }}>
        <div style={{
          background: 'var(--color-white)',
          border: '1px solid var(--color-gray-200)',
          borderRadius: 12,
          overflow: 'hidden',
        }}>
          {/* ヘッダ */}
          <div style={{
            padding: '12px 16px',
            background: 'var(--color-navy)',
            color: 'white',
            fontSize: 12,
            fontWeight: 600,
          }}>
            Supabase プレビュー
            <span style={{ fontSize: 10.5, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>
              FMデータがどこに入るか
            </span>
          </div>

          {previewData.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--color-gray-400)', fontSize: 12 }}>
              マッピングを設定するとプレビューが表示されます
            </div>
          ) : (
            <div style={{ maxHeight: 600, overflowY: 'auto' }}>
              {previewData.map((p, i) => (
                <div
                  key={p.sbCol}
                  onMouseEnter={() => setHoveredCol(p.sbCol)}
                  onMouseLeave={() => setHoveredCol(null)}
                  style={{
                    padding: '10px 16px',
                    borderTop: i > 0 ? '1px solid var(--color-gray-100)' : 'none',
                    background: hoveredCol === p.sbCol ? 'rgba(37,99,235,.06)' : 'transparent',
                    cursor: 'default',
                    transition: 'background .12s',
                  }}
                >
                  {/* カラム名 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <code style={{
                      fontSize: 10.5,
                      background: 'var(--color-gray-100)',
                      padding: '1px 5px',
                      borderRadius: 4,
                      color: 'var(--color-blue)',
                      fontFamily: 'monospace',
                    }}>
                      {p.sbCol}
                    </code>
                    <span style={{ fontSize: 10.5, color: 'var(--color-gray-400)' }}>{p.sbLabel}</span>
                  </div>
                  {/* FM → Supabase の矢印 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{
                      fontSize: 10.5,
                      background: 'var(--color-gray-100)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      color: 'var(--color-gray-600)',
                    }}>
                      FM: {p.fmField}
                    </span>
                    <span style={{ fontSize: 10, color: 'var(--color-gray-400)' }}>→</span>
                    <span style={{
                      fontSize: 10.5,
                      color: 'var(--color-gray-900)',
                      background: 'var(--color-blue-light)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      fontWeight: 500,
                      maxWidth: 110,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {p.sampleVal}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 凡例 */}
        <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--color-gray-50)', borderRadius: 8, fontSize: 11, color: 'var(--color-gray-400)', lineHeight: 1.6 }}>
          <div><strong style={{ color: 'var(--color-gray-600)' }}>プレビューの見方</strong></div>
          <div>FM のフィールド名 → Supabase のカラム名にサンプル値付きで表示します。</div>
          <div style={{ marginTop: 4 }}>行にマウスを乗せると対応するマッピング行がハイライトされます。</div>
        </div>
      </div>
    </div>
  )
}
