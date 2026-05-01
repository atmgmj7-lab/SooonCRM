import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// dev: Clerk認証をスキップ（本番復元は git checkout middleware.ts）
export default function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
