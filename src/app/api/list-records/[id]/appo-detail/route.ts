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

  const v =
    appo_detail_status === null || String(appo_detail_status).trim() === ''
      ? null
      : String(appo_detail_status).trim()

  const { error } = await supabase
    .from('list_records')
    .update({
      chosei: v === '調整中',
      saiyo_ok: v === '採用OK',
      saiyo_ng: v === '採用NG',
      juchu: v === '受注',
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', member.tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
