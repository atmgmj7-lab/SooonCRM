import { NextResponse } from 'next/server'

function isAuthorized(req: Request): boolean {
  const expected = process.env.CRON_SECRET
  if (req.headers.get('x-cron-secret') === expected) {
    return true
  }
  const auth = req.headers.get('authorization')
  if (!auth) {
    return false
  }
  const match = /^Bearer\s+(.*)$/i.exec(auth.trim())
  return Boolean(match && match[1].trim() === expected)
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({ success: true })
}
