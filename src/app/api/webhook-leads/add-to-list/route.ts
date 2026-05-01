import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

type SupabaseClient = ReturnType<typeof createAdminClient>

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? ''

async function addOneToList(
  supabase: SupabaseClient,
  webhookLead: Record<string, unknown>
): Promise<string> {
  const raw = (webhookLead.raw_data ?? {}) as Record<string, unknown>

  const rawPhones = raw.phone_numbers ?? raw.phone_number
  let phoneNumbers: string[]
  if (Array.isArray(rawPhones)) {
    phoneNumbers = rawPhones.map(String)
  } else if (typeof rawPhones === 'string' && rawPhones) {
    phoneNumbers = [rawPhones]
  } else {
    phoneNumbers = []
  }

  const { data: listRecord, error: insertErr } = await supabase
    .from('list_records')
    .insert({
      tenant_id: TENANT_ID,
      ad_name: (webhookLead.ad_name ?? raw.ad_name ?? null) as string | null,
      company_name: (raw.company_name ?? null) as string | null,
      representative_name: (raw.representative_name ?? null) as string | null,
      prefecture: (raw.prefecture ?? null) as string | null,
      phone_numbers: phoneNumbers,
      source: 'meta_ads',
      created_at: webhookLead.created_at as string,
    })
    .select('id')
    .single()

  if (insertErr || !listRecord) {
    throw new Error(insertErr?.message ?? 'list_records insert failed')
  }

  await supabase
    .from('webhook_leads')
    .update({
      status: 'added',
      added_to_list_id: listRecord.id,
      added_at: new Date().toISOString(),
    })
    .eq('id', webhookLead.id as string)

  return listRecord.id as string
}

export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!TENANT_ID) return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })

  const body = await request.json() as { id?: string; bulk?: boolean }
  const supabase = createAdminClient()

  if (body.bulk) {
    const { data: pending, error: fetchErr } = await supabase
      .from('webhook_leads')
      .select('*')
      .eq('tenant_id', TENANT_ID)
      .eq('status', 'pending')

    if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

    const results = await Promise.allSettled(
      (pending ?? []).map((lead) => addOneToList(supabase, lead as Record<string, unknown>))
    )
    const added = results.filter((r) => r.status === 'fulfilled').length
    const failed = results.filter((r) => r.status === 'rejected').length
    return NextResponse.json({ added, failed })
  }

  if (!body.id) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const { data: lead, error: fetchErr } = await supabase
    .from('webhook_leads')
    .select('*')
    .eq('id', body.id)
    .eq('tenant_id', TENANT_ID)
    .single()

  if (fetchErr || !lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    const listId = await addOneToList(supabase, lead as Record<string, unknown>)
    return NextResponse.json({ list_record_id: listId })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
