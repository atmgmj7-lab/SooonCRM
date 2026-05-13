export default function RelationsPage() {
  return (
    <div style={{ padding: '32px 24px', maxWidth: 800 }}>
      <h1 style={{
        fontSize: 18,
        fontWeight: 700,
        color: 'var(--color-gray-900)',
        marginBottom: 8,
      }}>
        リレーション管理
      </h1>
      <p style={{ fontSize: 13, color: 'var(--color-gray-400)', marginBottom: 24 }}>
        テーブル間の紐付けルールを設定します。
      </p>
      <div style={{
        background: 'var(--color-gray-50)',
        border: '1px solid var(--color-gray-200)',
        borderRadius: 12,
        padding: '32px 24px',
        textAlign: 'center',
        color: 'var(--color-gray-400)',
        fontSize: 13,
      }}>
        この機能は Phase B 以降で実装予定です。
      </div>
    </div>
  )
}
