import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const { data: lead, error: leadErr } = await supabase
    .from('leads')
    .select('*')
    .eq('id', id)
    .eq('tenant_id', member.tenant_id)
    .single()

  if (leadErr || !lead) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (lead.list_record_id) {
    return NextResponse.json({ customer_id: lead.list_record_id })
  }

  const phoneNumbers = lead.phone_number
    ? [{ number: lead.phone_number, label: 'main' }]
    : []

  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .insert({
      tenant_id: member.tenant_id,
      company_name: lead.company_name ?? null,
      name: lead.representative_name ?? null,
      phone_numbers: phoneNumbers,
      company_email: lead.email_address ?? null,
    })
    .select('id')
    .single()

  if (custErr || !customer) {
    return NextResponse.json({ error: custErr?.message ?? 'Insert failed' }, { status: 500 })
  }

  const { error: updateErr } = await supabase
    .from('leads')
    .update({ list_record_id: customer.id })
    .eq('id', id)
    .eq('tenant_id', member.tenant_id)

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 })

  return NextResponse.json({ customer_id: customer.id })
}
