import { auth } from '@/lib/auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  let body: { appo_detail_status?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { appo_detail_status } = body
  if (appo_detail_status === undefined) {
    return NextResponse.json({ error: 'appo_detail_status required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const tenantId = member.tenant_id

  const v =
    appo_detail_status === null || String(appo_detail_status).trim() === ''
      ? null
      : String(appo_detail_status).trim()

  const { data: lr, error: lrErr } = await supabase
    .from('list_records')
    .select('selected_lead_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single()

  if (lrErr || !lr) {
    return NextResponse.json({ error: 'List record not found' }, { status: 404 })
  }

  let leadId = lr.selected_lead_id as string | null
  if (!leadId) {
    const { data: fb } = await supabase
      .from('leads')
      .select('id')
      .eq('list_record_id', id)
      .eq('tenant_id', tenantId)
      .order('inquiry_at', { ascending: false, nullsFirst: false })
      .limit(1)
      .maybeSingle()
    leadId = fb?.id ?? null
  }

  if (!leadId) {
    return NextResponse.json(
      { error: 'No lead linked to this list record' },
      { status: 400 },
    )
  }

  const { error } = await supabase
    .from('leads')
    .update({
      appo_detail_status: v,
      updated_at: new Date().toISOString(),
    })
    .eq('id', leadId)
    .eq('tenant_id', tenantId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
