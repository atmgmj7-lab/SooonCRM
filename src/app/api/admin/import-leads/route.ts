import { auth } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

function normalizePhone(phone: string): string | null {
  let p = (phone ?? '').trim().replace(/[-\s()]/g, '')
  if (!p) return null
  if (p.startsWith('81') && p.length >= 11) p = '0' + p.slice(2)
  return p
}

function normalizeDate(d: string): string | null {
  if (!d) return null
  const s = d.trim().split(' ')[0]
  if (!s) return null
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(s)) {
    const [y, m, day] = s.split('/')
    return `${y}-${m.padStart(2, '0')}-${day.padStart(2, '0')}`
  }
  return s
}

function parseBool(v: string): boolean {
  return ['1', 'true', 'TRUE', '○', 'yes', 'YES'].includes(String(v ?? '').trim())
}

function parseIntOrNull(v: string): number | null {
  const n = parseInt(String(v ?? '').trim(), 10)
  return isNaN(n) ? null : n
}

export async function POST(request: Request) {
  console.log('[import-leads] POST received')

  const { userId } = await auth()
  console.log('[import-leads] userId:', userId ? 'found' : 'missing')
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = createAdminClient()

  const { data: member } = await supabase
    .from('tenant_members')
    .select('tenant_id')
    .eq('clerk_user_id', userId)
    .limit(1)
    .single()

  if (!member) return NextResponse.json({ error: 'No tenant' }, { status: 403 })

  const body = await request.json() as { rows: Record<string, string>[] }
  const rows = body.rows
  console.log('[import-leads] rows count:', rows?.length)

  if (!Array.isArray(rows) || rows.length === 0) {
    return NextResponse.json({ imported: 0, skipped: 0 })
  }

  const records = rows.map((row, idx) => ({
    tenant_id: member.tenant_id,
    inquiry_date: normalizeDate(row.inquiry_date ?? ''),
    ad_name: row.ad_name || null,
    company_name: row.company_name || null,
    rep_title: row.rep_title || null,
    representative_name: row.representative_name || null,
    prefecture: row.prefecture || null,
    phone_number: normalizePhone(row.phone_number ?? ''),
    email_address: row.email_address || null,
    lead_detail: row.lead_detail || null,
    form_q1: row.form_q1 || null,
    form_q2: row.form_q2 || null,
    form_q3: row.form_q3 || null,
    last_call_result: row.last_call_result || null,
    call_count: parseIntOrNull(row.call_count ?? '') ?? 0,
    recall_date: normalizeDate(row.recall_date ?? ''),
    recall_time: row.recall_time || null,
    jitsuyo_ok: parseBool(row.jitsuyo_ok ?? ''),
    ichiyou_ng: parseBool(row.ichiyou_ng ?? ''),
    order_closed: parseBool(row.order_closed ?? ''),
    initial_fee: parseIntOrNull(row.initial_fee ?? ''),
    monthly_fee: parseIntOrNull(row.monthly_fee ?? ''),
    contract_months: parseIntOrNull(row.contract_months ?? ''),
    total_revenue: parseIntOrNull(row.total_revenue ?? ''),
    imported_from_csv: true,
    csv_row_number: idx + 1,
  }))

  const { error } = await supabase.from('leads').insert(records)

  if (error) {
    console.error('[import-leads] insert error:', error.code, error.message)
    return NextResponse.json({ imported: 0, skipped: rows.length, error: error.message })
  }

  console.log('[import-leads] inserted:', records.length)
  return NextResponse.json({ imported: records.length, skipped: 0 })
}
