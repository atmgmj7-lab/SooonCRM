const agents = [
  { name: 'Lead Scorer', label: 'リードスコアラー' },
  { name: 'Call Time Optimizer', label: 'コール時間最適化' },
  { name: 'Response Advisor', label: 'レスポンスアドバイザー' },
  { name: 'Deal Predictor', label: '商談予測' },
  { name: 'Ad ROI Analyzer', label: '広告ROI分析' },
  { name: 'Self Improver', label: '自己改善' },
]

export function AgentStatusPanel() {
  return (
    <div
      className="rounded-xl p-6"
      style={{ border: '1px solid var(--color-gray-200)', backgroundColor: 'var(--color-white)' }}
    >
      <h2 className="text-[14px] font-semibold mb-4" style={{ color: 'var(--color-gray-900)' }}>
        エージェントステータス
      </h2>
      <div className="flex flex-col gap-3">
        {agents.map((agent) => (
          <div key={agent.name} className="flex items-center justify-between">
            <span className="text-[13px]" style={{ color: 'var(--color-gray-600)' }}>
              {agent.label}
            </span>
            <span
              className="text-[11px] px-2 py-0.5 rounded"
              style={{
                backgroundColor: 'var(--color-gray-100)',
                color: 'var(--color-gray-400)',
              }}
            >
              未設定
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
