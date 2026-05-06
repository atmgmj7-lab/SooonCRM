export function Header() {
  return (
    <header
      style={{
        height: 46,
        flexShrink: 0,
        backgroundColor: 'var(--color-white)',
        borderBottom: '1px solid var(--color-gray-200)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '0 24px',
        zIndex: 10,
      }}
    />
  )
}
