'use client'
import { useEffect } from 'react'

export default function AnalyticsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Analytics error:', error)
  }, [error])

  return (
    <div style={{
      flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12, background: '#F5F7FA',
    }}>
      <div style={{ fontSize: 32 }}>⚠️</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>
        データの読み込みに失敗しました
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', maxWidth: 300, textAlign: 'center' }}>
        {error.message}
      </div>
      <button
        onClick={reset}
        style={{
          padding: '8px 20px', borderRadius: 6, border: 'none',
          background: '#0D9488', color: '#fff', cursor: 'pointer', fontSize: 13,
        }}
      >
        再読み込み
      </button>
    </div>
  )
}
