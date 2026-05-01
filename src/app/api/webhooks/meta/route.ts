import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { normalizePhone } from '@/lib/leads/phone-match'

// GET: Meta webhook verification
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_VERIFY_TOKEN) {
    return new Response(challenge ?? '', { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

type FieldData = { name: string; values: string[] }
type MappedData = Record<string, string>

async function fetchLeadDetail(leadId: string): Promise<MappedData> {
  const token = process.env.META_ACCESS_TOKEN
  if (!token || !leadId) return {}

  try {
    const url = `https://graph.facebook.com/v25.0/${leadId}?fields=field_data&access_token=${token}`
    const res = await fetch(url)
    if (!res.ok) {
      console.error('[meta-webhook] Graph API error:', res.status, await res.text())
      return {}
    }
    const data = await res.json() as { field_data?: FieldData[] }
    const mapped: MappedData = {}
    for (const field of data.field_data ?? []) {
      mapped[field.name] = field.values[0] ?? ''
    }
    return mapped
  } catch (err) {
    console.error('[meta-webhook] fetchLeadDetail failed:', err)
    return {}
  }
}

// POST: Receive leadgen events from Meta Ads
export async function POST(request: Request) {
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) {
    return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })
  }

  const supabase = createAdminClient()

  const entries = (body?.entry as Record<string, unknown>[]) ?? []
  let saved = 0

  for (const entry of entries) {
    const changes = (entry?.changes as Record<string, unknown>[]) ?? []
    for (const change of changes) {
      if (change.field === 'leadgen') {
        const value = (change.value ?? {}) as Record<string, unknown>
        const leadId = (value.leadgen_id as string) ?? ''
        const mappedData = await fetchLeadDetail(leadId)
        const rawPhone = value.phone_number ?? value['電話番号'] ?? value.phone ?? mappedData.phone_number ?? ''
        const phoneNormalized = normalizePhone(String(rawPhone))

        const { data: matched } = phoneNormalized
          ? await supabase
              .from('list_records')
              .select('id, customer_id, fm_record_id')
              .eq('tenant_id', tenantId)
              .contains('phone_numbers', JSON.stringify([phoneNormalized]))
              .limit(1)
              .maybeSingle()
          : { data: null }

        const matchStatus = phoneNormalized ? (matched ? 'matched' : 'unmatched') : 'pending'

        const { data: insertedLead, error: insertError } = await supabase
          .from('webhook_leads')
          .insert({
            tenant_id: tenantId,
            raw_data: value,
            mapped_data: mappedData,
            source: 'meta_ads',
            ad_name: (value.ad_name as string) ?? mappedData.ad_name ?? null,
            phone_normalized: phoneNormalized || null,
            match_status: matchStatus,
            ...(matched
              ? {
                  status: 'added',
                  added_to_list_id: matched.id,
                  added_at: new Date().toISOString(),
                }
              : {
                  status: 'pending',
                }),
          })
          .select('id')
          .single()

        if (insertError) {
          console.error('[meta-webhook] insert error:', insertError)
          return NextResponse.json({ error: insertError.message }, { status: 500 })
        }

        if (matched && insertedLead) {
          const { error: listUpdateError } = await supabase
            .from('list_records')
            .update({ webhook_lead_id: insertedLead.id, updated_at: new Date().toISOString() })
            .eq('id', matched.id)

          if (listUpdateError) {
            console.error('[meta-webhook] list_records update error:', listUpdateError)
          }
        }

        saved += 1
      }
    }
  }

  return NextResponse.json({ received: true, saved })
}
