import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getTenantId(userId: string) {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()
  return data?.tenant_id ?? null
}

export async function GET(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getTenantId(userId)
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const { searchParams } = new URL(request.url)
  const table = searchParams.get('table') ?? ''

  const supabase = createAdminClient()
  let q = supabase
    .from('field_mappings')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('source_field')

  if (table) q = q.eq('target_table', table)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ mappings: data ?? [] })
}

type MappingInput = {
  source_field: string
  target_field: string
  target_table: string
  label_ja?: string
  enabled?: boolean
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = await getTenantId(userId)
  if (!tenantId) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const body = await request.json()
  const mappings: MappingInput[] = body.mappings ?? []

  if (!Array.isArray(mappings)) {
    return NextResponse.json({ error: 'mappings must be array' }, { status: 400 })
  }

  for (const m of mappings) {
    if (!m.source_field || !m.target_field || !m.target_table) {
      return NextResponse.json(
        { error: 'source_field, target_field, target_table are required' },
        { status: 400 },
      )
    }
  }

  const supabase = createAdminClient()
  const rows = mappings.map((m) => ({
    tenant_id:    tenantId,
    source_field: m.source_field,
    source_type:  'fm',
    target_field: m.target_field,
    target_table: m.target_table,
    label_ja:     m.label_ja ?? null,
    enabled:      m.enabled ?? true,
    is_required:  false,
  }))

  const { error } = await supabase
    .from('field_mappings')
    .upsert(rows, { onConflict: 'tenant_id,source_field,target_table' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, count: rows.length })
}
