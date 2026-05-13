import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const MAX_IDS = 200

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const rawIds = (body as { ids?: unknown }).ids
  if (!Array.isArray(rawIds)) {
    return NextResponse.json({ error: 'ids must be an array' }, { status: 400 })
  }
  if (rawIds.length === 0) {
    return NextResponse.json({ error: 'ids must not be empty' }, { status: 400 })
  }
  if (rawIds.length > MAX_IDS) {
    return NextResponse.json({ error: `ids must not exceed ${MAX_IDS} items` }, { status: 400 })
  }
  if (!rawIds.every((id): id is string => typeof id === 'string')) {
    return NextResponse.json({ error: 'ids must be an array of strings' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { error, count } = await supabase
    .from('leads')
    .delete({ count: 'exact' })
    .eq('tenant_id', tenantId)
    .in('id', rawIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, deleted: count ?? 0 })
}
