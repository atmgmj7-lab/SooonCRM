import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const tenantId = process.env.DEFAULT_TENANT_ID
  if (!tenantId) return NextResponse.json({ error: 'DEFAULT_TENANT_ID not set' }, { status: 500 })

  const supabase = createAdminClient()

  const { data, count, error } = await supabase
    .from('webhook_leads')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('received_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ leads: data ?? [], total: count ?? 0 })
}
