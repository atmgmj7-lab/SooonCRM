import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

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
  const inserts: Record<string, unknown>[] = []

  for (const entry of entries) {
    const changes = (entry?.changes as Record<string, unknown>[]) ?? []
    for (const change of changes) {
      if (change.field === 'leadgen') {
        const value = (change.value ?? {}) as Record<string, unknown>
        const leadId = (value.leadgen_id as string) ?? ''
        const mappedData = await fetchLeadDetail(leadId)

        inserts.push({
          tenant_id: tenantId,
          raw_data: value,
          mapped_data: mappedData,
          source: 'meta_ads',
          status: 'pending',
          ad_name: (value.ad_name as string) ?? mappedData.ad_name ?? null,
        })
      }
    }
  }

  if (inserts.length > 0) {
    const { error } = await supabase.from('webhook_leads').insert(inserts)
    if (error) {
      console.error('[meta-webhook] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true, saved: inserts.length })
}
