'use client'

import { useState } from 'react'

type SyncResult = {
  totalSynced?: number
  totalSkipped?: number
  totalErrors?: number
  totalDeleted?: number
  count?: number
}

function SyncCard({
  title,
  description,
  endpoint,
}: {
  title: string
  description: string
  endpoint: string
}) {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function run() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const json = await res.json() as SyncResult & { ok?: boolean; error?: string }
      if (!res.ok || json.error) {
        setError(json.error ?? `エラー (${res.status})`)
      } else {
        setResult(json)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラー')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      flex: 1,
      border: '1px solid var(--color-gray-200)',
      borderRadius: 12,
      padding: 24,
      background: 'var(--color-white)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-900)', marginBottom: 6 }}>
          {title}
        </h3>
        <p style={{ fontSize: 12, color: 'var(--color-gray-600)', lineHeight: 1.5 }}>
          {description}
        </p>
      </div>

      <button
        onClick={run}
        disabled={loading}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 8,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--color-gray-200)' : 'var(--color-blue)',
          color: loading ? 'var(--color-gray-400)' : '#fff',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '同期中...' : '同期実行'}
      </button>

      {result && (
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-success)',
          background: 'var(--color-success-bg)',
          padding: '10px 14px',
          borderRadius: 8,
          lineHeight: 1.7,
        }}>
          <div>同期: {result.totalSynced ?? 0} 件</div>
          <div>スキップ: {result.totalSkipped ?? 0} 件</div>
          <div>削除: {result.totalDeleted ?? 0} 件</div>
          {(result.totalErrors ?? 0) > 0 && (
            <div style={{ color: 'var(--color-warning)' }}>エラー: {result.totalErrors} 件</div>
          )}
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 12,
          color: 'var(--color-danger)',
          background: 'var(--color-danger-bg)',
          padding: '10px 14px',
          borderRadius: 8,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

function MetaLeadSyncCard() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  async function run() {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const body: Record<string, string> = {}
      if (since) body.since = since
      if (until) body.until = until
      const res = await fetch('/api/admin/pull-meta-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as SyncResult & { ok?: boolean; error?: string; imported?: number }
      if (!res.ok || json.error) {
        setError(json.error ?? `エラー (${res.status})`)
      } else {
        setResult({ totalSynced: json.imported ?? json.totalSynced ?? 0, totalSkipped: json.totalSkipped })
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラー')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      flex: 1,
      border: '1px solid var(--color-gray-200)',
      borderRadius: 12,
      padding: 24,
      background: 'var(--color-white)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-900)', marginBottom: 6 }}>
          Metaリード取得
        </h3>
        <p style={{ fontSize: 12, color: 'var(--color-gray-600)', lineHeight: 1.5 }}>
          Meta Graph API からリードフォームの回答を取得・登録します。期間を指定してバックフィルできます。空白の場合は直近のリードを取得します。
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--color-gray-600)' }}>
          開始日
          <input
            type="date"
            value={since}
            onChange={(e) => setSince(e.target.value)}
            style={{
              fontSize: 12,
              padding: '5px 8px',
              border: '1px solid var(--color-gray-200)',
              borderRadius: 6,
              background: 'var(--color-white)',
            }}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--color-gray-600)' }}>
          終了日
          <input
            type="date"
            value={until}
            onChange={(e) => setUntil(e.target.value)}
            style={{
              fontSize: 12,
              padding: '5px 8px',
              border: '1px solid var(--color-gray-200)',
              borderRadius: 6,
              background: 'var(--color-white)',
            }}
          />
        </label>
      </div>

      <button
        onClick={run}
        disabled={loading}
        style={{
          alignSelf: 'flex-start',
          padding: '8px 16px',
          fontSize: 13,
          fontWeight: 600,
          borderRadius: 8,
          border: 'none',
          cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--color-gray-200)' : 'var(--color-blue)',
          color: loading ? 'var(--color-gray-400)' : '#fff',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? '取得中...' : '取得実行'}
      </button>

      {result && (
        <div style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-success)',
          background: 'var(--color-success-bg)',
          padding: '10px 14px',
          borderRadius: 8,
          lineHeight: 1.7,
        }}>
          <div>登録: {result.totalSynced ?? 0} 件</div>
          {result.totalSkipped !== undefined && <div>スキップ: {result.totalSkipped} 件</div>}
        </div>
      )}

      {error && (
        <div style={{
          fontSize: 12,
          color: 'var(--color-danger)',
          background: 'var(--color-danger-bg)',
          padding: '10px 14px',
          borderRadius: 8,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

function DedupCard() {
  const [loading, setLoading] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'checked' | 'done'>('idle')
  const [count, setCount] = useState(0)
  const [deleted, setDeleted] = useState(0)
  const [error, setError] = useState<string | null>(null)

  async function checkDuplicates() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/dedup-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: true }),
      })
      const json = await res.json() as { ok?: boolean; duplicates_found?: number; error?: string }
      if (!res.ok || json.error) { setError(json.error ?? `エラー (${res.status})`); return }
      setCount(json.duplicates_found ?? 0)
      setPhase('checked')
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラー')
    } finally {
      setLoading(false)
    }
  }

  async function deleteDuplicates() {
    if (!confirm(`${count}件の重複リードを削除します。この操作は元に戻せません。続行しますか？`)) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/dedup-leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dry_run: false }),
      })
      const json = await res.json() as { ok?: boolean; deleted?: number; error?: string }
      if (!res.ok || json.error) { setError(json.error ?? `エラー (${res.status})`); return }
      setDeleted(json.deleted ?? 0)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : '通信エラー')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      flex: 1,
      border: '1px solid var(--color-gray-200)',
      borderRadius: 12,
      padding: 24,
      background: 'var(--color-white)',
      display: 'flex',
      flexDirection: 'column',
      gap: 16,
    }}>
      <div>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-gray-900)', marginBottom: 6 }}>
          重複リード削除
        </h3>
        <p style={{ fontSize: 12, color: 'var(--color-gray-600)', lineHeight: 1.5 }}>
          Webhook + pull-meta-leads の二重取込による重複リードを検出・削除します。
          同一リスト・同一日の Meta広告リードが複数ある場合、meta_lead_id を持つ方を残して削除します。
        </p>
      </div>

      {phase === 'idle' && (
        <button onClick={checkDuplicates} disabled={loading} style={{
          alignSelf: 'flex-start', padding: '8px 16px', fontSize: 13, fontWeight: 600,
          borderRadius: 8, border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
          background: loading ? 'var(--color-gray-200)' : 'var(--color-warning-bg)',
          color: loading ? 'var(--color-gray-400)' : 'var(--color-warning)',
        }}>
          {loading ? '確認中...' : '重複を確認する'}
        </button>
      )}

      {phase === 'checked' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: count > 0 ? 'var(--color-danger)' : 'var(--color-success)' }}>
            {count > 0 ? `重複リード ${count} 件が見つかりました` : '重複リードは見つかりません'}
          </div>
          {count > 0 && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={deleteDuplicates} disabled={loading} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: 'none', cursor: loading ? 'not-allowed' : 'pointer',
                background: loading ? 'var(--color-gray-200)' : 'var(--color-danger)',
                color: loading ? 'var(--color-gray-400)' : '#fff',
              }}>
                {loading ? '削除中...' : `${count}件を削除する`}
              </button>
              <button onClick={() => setPhase('idle')} disabled={loading} style={{
                padding: '8px 16px', fontSize: 13, fontWeight: 600, borderRadius: 8,
                border: '1px solid var(--color-gray-200)', background: 'var(--color-white)',
                color: 'var(--color-gray-600)', cursor: 'pointer',
              }}>
                キャンセル
              </button>
            </div>
          )}
        </div>
      )}

      {phase === 'done' && (
        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-success)', background: 'var(--color-success-bg)', padding: '10px 14px', borderRadius: 8 }}>
          {deleted} 件の重複リードを削除しました
        </div>
      )}

      {error && (
        <div style={{ fontSize: 12, color: 'var(--color-danger)', background: 'var(--color-danger-bg)', padding: '10px 14px', borderRadius: 8 }}>
          {error}
        </div>
      )}
    </div>
  )
}

export default function SyncPage() {
  return (
    <div style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-gray-900)', marginBottom: 4 }}>
          手動同期
        </h1>
        <p style={{ fontSize: 12, color: 'var(--color-gray-600)' }}>
          FileMakerから差分データを手動で取り込みます
        </p>
      </div>

      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: 4 }}>
          FileMaker 同期
        </h2>
        <p style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>
          過去分も含めて全件取得します。modId が同じレコードはスキップされるため安全に再実行できます。
        </p>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <SyncCard
          title="リスト情報同期"
          description="FileMakerのリスト情報を全件差分同期します。追加・変更レコードのみ更新。FMに存在しないレコードはソフトデリートされます。"
          endpoint="/api/admin/sync-from-fm"
        />
        <SyncCard
          title="コール履歴同期"
          description="FileMakerのコール履歴を全件差分同期します。過去分も含めて正確に取得されます。"
          endpoint="/api/admin/sync-calls"
        />
      </div>

      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: 4 }}>
          Meta 広告 / リード
        </h2>
        <p style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>
          Meta Graph API からリードを取得します。期間を指定してバックフィルできます。
        </p>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetaLeadSyncCard />
      </div>

      <div style={{ marginBottom: 8 }}>
        <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gray-600)', marginBottom: 4 }}>
          データ補完
        </h2>
        <p style={{ fontSize: 11, color: 'var(--color-gray-400)' }}>
          既存データの不足項目を補完します。
        </p>
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <SyncCard
          title="広告名バックフィル"
          description="リードの広告名（ad_name）が空のレコードを、紐づくリスト情報の広告名で補完します。FMから同期したリードも対象です。"
          endpoint="/api/admin/backfill-ad-name"
        />
      </div>

    </div>
  )
}
