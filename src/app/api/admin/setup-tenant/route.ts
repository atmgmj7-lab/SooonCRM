import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST() {
  const { userId } = await auth()
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const { data: existing } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (existing) {
    return NextResponse.json({ tenantId: existing.tenant_id, created: false })
  }

  const { data: tenant, error: tenantError } = await supabase
    .from('tenants')
    .insert({
      clerk_org_id: userId,
      name: 'Sooon',
      mode: 'self_hosted',
    })
    .select('id')
    .single()

  if (tenantError || !tenant) {
    return NextResponse.json({ error: 'Failed to create tenant' }, { status: 500 })
  }

  await supabase.from('tenant_members').insert({
    tenant_id: tenant.id,
    clerk_user_id: userId,
    role: 'admin',
  })

  return NextResponse.json({ tenantId: tenant.id, created: true })
}
