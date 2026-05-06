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
  const { status } = (await req.json()) as { status?: string }
  if (!status) return NextResponse.json({ error: 'status required' }, { status: 400 })

  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const { error } = await supabase
    .from('leads')
    .update({
      status,
      last_call_result: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', member.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
