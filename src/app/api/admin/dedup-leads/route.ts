import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

type LeadRow = {
  id: string
  list_record_id: string | null
  phone_number: string | null
  inquiry_date: string | null
  created_at: string
  source_data: Record<string, unknown> | null
  list_records: { phone_numbers: unknown } | { phone_numbers: unknown }[] | null
}

/**
 * Meta広告リードの重複削除
 *
 * グループ化戦略（優先順）:
 * 1. list_records.phone_numbers の先頭番号（最も正確）
 * 2. leads.phone_number（phone_numbersがない場合）
 * 3. list_record_id（phoneが完全にない場合のフォールバック）
 *
 * dry_run=true で削除対象件数を確認のみ（デフォルト）
 */
export async function POST(request: Request) {
  const { userId } = await auth()
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({})) as { dry_run?: boolean }
  const dryRun = body.dry_run !== false

  const supabase = createAdminClient()

  // list_records の phone_numbers も一緒に取得
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, list_record_id, phone_number, inquiry_date, created_at, source_data, list_records(phone_numbers)')
    .eq('tenant_id', TENANT_ID)
    .eq('source', 'meta_ads')
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // グループキーを決定（list_records.phone_numbers → leads.phone_number → list_record_id の優先順）
  function getGroupKey(lead: LeadRow): string {
    const lrPhone = (() => {
      const lr = lead.list_records
      const pn = Array.isArray(lr) ? (lr[0]?.phone_numbers) : lr?.phone_numbers
      if (Array.isArray(pn) && pn.length > 0) return String(pn[0])
      if (typeof pn === 'string' && pn) {
        try {
          const parsed = JSON.parse(pn) as unknown
          if (Array.isArray(parsed) && parsed.length > 0) return String(parsed[0])
        } catch { /* ignore */ }
      }
      return null
    })()
    if (lrPhone) return `phone:${lrPhone}`
    if (lead.phone_number) return `phone:${lead.phone_number}`
    return `lr:${lead.list_record_id ?? 'null'}`
  }

  const groups = new Map<string, LeadRow[]>()
  for (const lead of (leads ?? []) as LeadRow[]) {
    const key = getGroupKey(lead)
    const arr = groups.get(key) ?? []
    arr.push(lead)
    groups.set(key, arr)
  }

  const toDeleteSet = new Set<string>()

  for (const group of groups.values()) {
    if (group.length <= 1) continue

    const withMetaId = group.filter((l) => {
      const sd = l.source_data
      return sd != null && typeof sd['meta_lead_id'] === 'string'
    })
    const withoutMetaId = group.filter((l) => {
      const sd = l.source_data
      return sd == null || typeof sd['meta_lead_id'] !== 'string'
    })

    if (withMetaId.length > 0) {
      // meta_lead_id なし（webhook重複）を全削除
      for (const l of withoutMetaId) toDeleteSet.add(l.id)

      // 同じ meta_lead_id が複数ある場合、oldest 1件を残して削除
      const uniqueMetaIds = new Map<string, LeadRow>()
      for (const l of withMetaId) {
        const mid = (l.source_data as Record<string, unknown>)['meta_lead_id'] as string
        if (!uniqueMetaIds.has(mid)) {
          uniqueMetaIds.set(mid, l)
        } else {
          toDeleteSet.add(l.id)
        }
      }
    } else {
      // 全員 meta_lead_id なし → oldest 1件を残して削除
      for (const l of group.slice(1)) toDeleteSet.add(l.id)
    }
  }

  const toDelete = [...toDeleteSet]

  if (dryRun) {
    return NextResponse.json({
      ok: true,
      dry_run: true,
      duplicates_found: toDelete.length,
      message: `${toDelete.length}件の重複リードが削除対象です。dry_run: false で実際に削除します。`,
    })
  }

  let deleted = 0
  const BATCH = 100
  for (let i = 0; i < toDelete.length; i += BATCH) {
    const batch = toDelete.slice(i, i + BATCH)
    const { error: delErr } = await supabase
      .from('leads')
      .delete()
      .in('id', batch)
      .eq('tenant_id', TENANT_ID)
    if (delErr) return NextResponse.json({ error: delErr.message, deleted }, { status: 500 })
    deleted += batch.length
  }

  return NextResponse.json({ ok: true, dry_run: false, deleted })
}
