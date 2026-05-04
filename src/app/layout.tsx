import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'GrowthHub CRM',
  description: 'AI CRM OS',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" suppressHydrationWarning className="h-full antialiased">
      <body className="min-h-full flex flex-col">
        {children}
      </body>
    </html>
  )
}
