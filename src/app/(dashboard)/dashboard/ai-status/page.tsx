import { DataAccumulationPanel } from '@/components/dashboard/ai-status/DataAccumulationPanel'
import { AgentStatusPanel } from '@/components/dashboard/ai-status/AgentStatusPanel'
import { LearningProgressPanel } from '@/components/dashboard/ai-status/LearningProgressPanel'
import { AdRoiPanel } from '@/components/dashboard/ai-status/AdRoiPanel'

export default function AiStatusPage() {
  return (
    <div className="max-w-7xl mx-auto">
      <h1 className="text-[18px] font-semibold mb-6" style={{ color: 'var(--color-gray-900)' }}>
        AIステータス
      </h1>
      <div className="grid grid-cols-2 gap-6 mb-6">
        <DataAccumulationPanel />
        <AgentStatusPanel />
      </div>
      <div className="grid grid-cols-2 gap-6">
        <LearningProgressPanel />
        <AdRoiPanel />
      </div>
    </div>
  )
}
