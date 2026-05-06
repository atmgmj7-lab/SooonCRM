export default function Loading() {
  return (
    <div className="p-6 space-y-4" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <div className="h-8 w-48 rounded-lg animate-pulse" style={{ background: 'var(--color-gray-200)' }} />
      <div className="grid grid-cols-6 gap-3">
        {Array(6).fill(0).map((_, i) => (
          <div key={i} className="h-24 rounded-xl animate-pulse" style={{ background: 'var(--color-gray-200)' }} />
        ))}
      </div>
      <div className="h-10 rounded-lg animate-pulse" style={{ background: 'var(--color-gray-200)' }} />
      <div className="h-96 rounded-xl animate-pulse" style={{ background: 'var(--color-gray-200)' }} />
    </div>
  )
}
