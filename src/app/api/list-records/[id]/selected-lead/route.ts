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
  let body: { selected_lead_id?: string | null }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { selected_lead_id } = body
  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  if (selected_lead_id) {
    const { data: lead, error: leadErr } = await supabase
      .from('leads')
      .select('id')
      .eq('id', selected_lead_id)
      .eq('list_record_id', id)
      .eq('tenant_id', member.tenant_id)
      .maybeSingle()

    if (leadErr) return NextResponse.json({ error: leadErr.message }, { status: 500 })
    if (!lead) return NextResponse.json({ error: 'Lead not found for this list' }, { status: 400 })
  }

  const { error } = await supabase
    .from('list_records')
    .update({
      selected_lead_id: selected_lead_id || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', member.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
