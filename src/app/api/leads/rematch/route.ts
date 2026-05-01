import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? ''

export async function POST() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!TENANT_ID) return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })

  const supabase = createAdminClient()

  const { data: unmatched, error: fetchErr } = await supabase
    .from('webhook_leads')
    .select('id, phone_normalized')
    .eq('tenant_id', TENANT_ID)
    .eq('match_status', 'unmatched')
    .not('phone_normalized', 'is', null)

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  let matched = 0
  for (const lead of unmatched ?? []) {
    const phone = lead.phone_normalized
    if (!phone) continue

    const { data: listRecord } = await supabase
      .from('list_records')
      .select('id')
      .eq('tenant_id', TENANT_ID)
      .contains('phone_numbers', JSON.stringify([phone]))
      .limit(1)
      .maybeSingle()

    if (!listRecord) continue

    await supabase
      .from('webhook_leads')
      .update({
        match_status: 'matched',
        status: 'added',
        added_to_list_id: listRecord.id,
        added_at: new Date().toISOString(),
      })
      .eq('id', lead.id)

    await supabase
      .from('list_records')
      .update({
        webhook_lead_id: lead.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', listRecord.id)

    matched++
  }

  return NextResponse.json({ matched, total: unmatched?.length ?? 0 })
}
