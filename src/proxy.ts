// Clerk除去済み — middleware は middleware.ts で管理
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export default function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
