import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const TENANT_ID = process.env.DEFAULT_TENANT_ID!

function normalizePhone(raw: string): string[] {
  const digits = raw.replace(/\D/g, '')
  if (!digits) return []
  const patterns: string[] = [digits]
  if (digits.startsWith('81')) patterns.push('0' + digits.slice(2))
  if (digits.length === 10 && !digits.startsWith('0')) patterns.push('0' + digits)
  if (digits.length === 11 && digits.startsWith('0')) patterns.push(digits.slice(1))
  return [...new Set(patterns)]
}

async function main() {
  console.log('未マッチleads名寄せバッチ開始')

  const { data: unmatchedLeads, error } = await supabase
    .from('leads')
    .select('id, phone_number, tenant_id')
    .is('list_record_id', null)
    .eq('tenant_id', TENANT_ID)
    .not('phone_number', 'is', null)
    .not('phone_number', 'eq', '')

  if (error) {
    console.error('leads取得エラー:', error)
    process.exit(1)
  }

  console.log(`未マッチ件数: ${unmatchedLeads?.length ?? 0}`)

  let matched = 0
  let unmatched = 0
  let processed = 0

  for (const lead of unmatchedLeads ?? []) {
    processed++
    if (processed % 100 === 0) {
      console.log(`処理中: ${processed}/${unmatchedLeads?.length}`)
    }

    const phonePatterns = normalizePhone(lead.phone_number ?? '')
    let foundRecord = null

    for (const phone of phonePatterns) {
      const { data } = await supabase
        .from('list_records')
        .select('id, customer_id')
        .contains('phone_numbers', JSON.stringify([phone]))
        .eq('tenant_id', TENANT_ID)
        .maybeSingle()

      if (data) {
        foundRecord = data
        break
      }
    }

    if (foundRecord) {
      await supabase
        .from('leads')
        .update({
          list_record_id: foundRecord.id,
          customer_id: foundRecord.customer_id,
        })
        .eq('id', lead.id)
      matched++
    } else {
      unmatched++
    }
  }

  console.log('===== 完了 =====')
  console.log(`新たにマッチ: ${matched}件`)
  console.log(`依然未マッチ: ${unmatched}件`)
}

main().catch(console.error)
