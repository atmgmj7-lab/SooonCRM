/**
 * FBリストCSVから leads を電話番号で照合し、appo_detail_status・source_data.form_answers のみ補完UPDATE。
 * マッチしない行はINSERTせずスキップ。既存レコードは削除しない。
 *
 * 実行例:
 *   # ドライラン（デフォルト・Supabaseは更新しない）
 *   npx tsx src/scripts/reimport-leads.ts --csv="/path/to/file.csv"
 *
 *   # 本番（UPDATE実行）
 *   npx tsx src/scripts/reimport-leads.ts --csv="/path/to/file.csv" --execute
 *
 * 必要な環境変数（.env.local）:
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEFAULT_TENANT_ID
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { config } from 'dotenv'
import { parse } from 'csv-parse/sync'
import { createClient } from '@supabase/supabase-js'

config({ path: resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const TENANT_ID = process.env.DEFAULT_TENANT_ID ?? 'dde9bea6-a017-49e6-a1b6-88494e1e3b4d'

/** 照合キー用: 数字のみにし、81↔0 など複数表記を生成（scripts/rematch-leads と同系） */
function matchingVariants(raw: string | null | undefined): string[] {
  if (!raw) return []
  const digits = String(raw).replace(/\D/g, '')
  if (!digits) return []
  const patterns = new Set<string>([digits])
  if (digits.startsWith('81')) patterns.add('0' + digits.slice(2))
  if (digits.startsWith('0')) patterns.add('81' + digits.slice(1))
  if (digits.length === 10 && !digits.startsWith('0')) {
    patterns.add('0' + digits)
  }
  return [...patterns]
}

function parseBoolCell(v: string | undefined): boolean {
  const s = String(v ?? '').trim().toUpperCase()
  return s === 'TRUE' || s === '1' || s === 'YES' || s === 'X'
}

/**
 * アポOK内訳チェックボックスから1値に集約。
 * 複数TRUEのときはより進んだステータスを優先: 受注 > 採用NG > 採用OK > 調整中
 */
const APPO_PRIORITY = ['調整中', '採用OK', '採用NG', '受注'] as const
type AppoFlag = (typeof APPO_PRIORITY)[number]

function resolveAppoDetailStatus(flags: Record<AppoFlag, boolean>): string | undefined {
  const TRUE = [...APPO_PRIORITY].reverse().find((k) => flags[k])
  return TRUE
}

function trimBom(s: string): string {
  return s.replace(/^\uFEFF/, '').trim()
}

/** ヘッダー行から列位置を決定 */
function resolveColumnIndices(header: string[]) {
  const h = header.map(trimBom)
  const idx = (exact: string) => h.indexOf(exact)

  const appoCols: Partial<Record<AppoFlag, number>> = {}
  for (const name of APPO_PRIORITY) {
    const i = idx(name as string)
    if (i >= 0) appoCols[name] = i
  }

  const totalRevIdx = idx('総受注額')
  let formIndices: { header: string; index: number }[] = []
  if (totalRevIdx >= 0 && totalRevIdx + 4 <= h.length) {
    formIndices = h.slice(totalRevIdx + 1, totalRevIdx + 5).map((headerName, offset) => ({
      header: trimBom(headerName),
      index: totalRevIdx + 1 + offset,
    }))
  }

  let phoneConvertedIdx = h.findIndex((cell) => /81変換/.test(cell))
  if (phoneConvertedIdx < 0) phoneConvertedIdx = h.indexOf('電話番号（81変換）')

  const phoneRawIdx = idx('phone_number')

  const missing: string[] = []
  if (phoneRawIdx < 0 && phoneConvertedIdx < 0) missing.push('phone_number または 電話番号（81変換）')
  for (const name of APPO_PRIORITY) {
    if (appoCols[name] === undefined) missing.push(name)
  }
  if (formIndices.length < 4) missing.push('フォーム設問4列（総受注額の直後）')

  return {
    phoneConvertedIdx,
    phoneRawIdx,
    appoCols,
    formIndices,
    missing,
  }
}

function rowPhoneRaw(
  cells: string[],
  phoneConvertedIdx: number,
  phoneRawIdx: number
): string {
  const conv = phoneConvertedIdx >= 0 ? trimBom(cells[phoneConvertedIdx] ?? '') : ''
  const raw = phoneRawIdx >= 0 ? trimBom(cells[phoneRawIdx] ?? '') : ''
  return conv || raw
}

function buildFormAnswers(
  cells: string[],
  formIndices: { header: string; index: number }[]
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const { header, index } of formIndices) {
    const key = trimBom(header)
    if (!key) continue
    const val = trimBom(cells[index] ?? '')
    if (val !== '') out[key] = val
  }
  return out
}

function parseArgs() {
  const argv = process.argv.slice(2)
  let csvPath = ''
  let execute = false
  for (const a of argv) {
    if (a === '--execute') execute = true
    else if (a.startsWith('--csv=')) csvPath = a.slice('--csv='.length)
  }
  if (!csvPath && argv[0] && !argv[0].startsWith('--')) csvPath = argv[0]
  return { csvPath: csvPath ? resolve(csvPath) : '', execute }
}

async function fetchAllLeadsForTenant(): Promise<
  { id: string; phone_number: string | null; source_data: Record<string, unknown> | null }[]
> {
  const pageSize = 1000
  let from = 0
  const all: {
    id: string
    phone_number: string | null
    source_data: Record<string, unknown> | null
  }[] = []
  for (;;) {
    const { data, error } = await supabase
      .from('leads')
      .select('id, phone_number, source_data')
      .eq('tenant_id', TENANT_ID)
      .range(from, from + pageSize - 1)

    if (error) throw new Error(`leads fetch: ${error.message}`)
    const batch = data ?? []
    all.push(...batch)
    if (batch.length < pageSize) break
    from += pageSize
  }
  return all
}

function buildPhoneIndex(
  rows: {
    id: string
    phone_number: string | null
    source_data: Record<string, unknown> | null
  }[]
): Map<string, Set<string>> {
  const variantToLeadIds = new Map<string, Set<string>>()

  function link(variant: string, leadId: string) {
    if (!variantToLeadIds.has(variant)) variantToLeadIds.set(variant, new Set())
    variantToLeadIds.get(variant)!.add(leadId)
  }

  for (const row of rows) {
    const vars = new Set<string>()
    for (const v of matchingVariants(row.phone_number)) vars.add(v)
    const sd = row.source_data ?? {}
    const sdp = sd.phone_number ?? sd['電話番号']
    if (typeof sdp === 'string') {
      for (const v of matchingVariants(sdp)) vars.add(v)
    }
    for (const v of vars) link(v, row.id)
  }
  return variantToLeadIds
}

function lookupLeadIds(phoneRaw: string, index: Map<string, Set<string>>): string[] {
  const ids = new Set<string>()
  for (const v of matchingVariants(phoneRaw)) {
    const set = index.get(v)
    if (set) for (const id of set) ids.add(id)
  }
  return [...ids]
}

function explainUsage(): string {
  return `
=== reimport-leads ===
1. ドライランで対象件数を確認（--execute を付けない）
2. 問題なければ --execute で本番UPDATE

コマンド:
  npx tsx src/scripts/reimport-leads.ts --csv="/絶対/または/相対/パス/ファイル.csv"
  npm run reimport-leads -- --csv="/path/to/file.csv"
  npm run reimport-leads -- --csv="/path/to/file.csv" --execute
`.trim()
}

async function main() {
  const { csvPath, execute } = parseArgs()

  console.log(explainUsage())

  if (!csvPath) {
    console.error('エラー: --csv=/absolute/or/relative/path.csv を指定してください。')
    process.exit(1)
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error(
      'エラー: NEXT_PUBLIC_SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY が .env.local に必要です。'
    )
    process.exit(1)
  }

  console.log(`モード: ${execute ? '本番 UPDATE' : 'ドライラン（更新なし）'}`)
  console.log(`CSV: ${csvPath}`)
  console.log(`tenant_id: ${TENANT_ID}`)

  const content = readFileSync(csvPath, 'utf8')
  const rows: string[][] = parse(content, {
    relax_column_count: true,
    skip_empty_lines: true,
    bom: true,
  })

  if (rows.length < 2) {
    console.error('CSVにヘッダー以外の行がありません。')
    process.exit(1)
  }

  const header = rows[0] ?? []
  const col = resolveColumnIndices(header)
  if (col.missing.length) {
    console.error('CSVヘッダーが想定と異なります。不足:', col.missing.join(', '))
    process.exit(1)
  }

  const leads = await fetchAllLeadsForTenant()
  const phoneIndex = buildPhoneIndex(leads)
  const leadSourceById = new Map(leads.map((r) => [r.id, r.source_data ?? {}]))

  let skipNoPhone = 0
  let skipNoMatch = 0
  let skipNoPayload = 0
  let success = 0
  let errors = 0

  type Pending = { leadId: string; appo?: string; formAnswers: Record<string, string> }
  const pendingByLead = new Map<string, Pending>()

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r] ?? []
    const phoneRaw = rowPhoneRaw(cells, col.phoneConvertedIdx, col.phoneRawIdx)
    if (!phoneRaw.replace(/\D/g, '')) {
      skipNoPhone++
      continue
    }

    const leadIds = lookupLeadIds(phoneRaw, phoneIndex)
    if (leadIds.length === 0) {
      skipNoMatch++
      continue
    }

    const flags = {
      調整中: parseBoolCell(cells[col.appoCols['調整中']!] ?? ''),
      採用OK: parseBoolCell(cells[col.appoCols['採用OK']!] ?? ''),
      採用NG: parseBoolCell(cells[col.appoCols['採用NG']!] ?? ''),
      受注: parseBoolCell(cells[col.appoCols['受注']!] ?? ''),
    }
    const appo = resolveAppoDetailStatus(flags)
    const formAnswers = buildFormAnswers(cells, col.formIndices)

    if (appo === undefined && Object.keys(formAnswers).length === 0) {
      skipNoPayload++
      continue
    }

    for (const leadId of leadIds) {
      const prev = pendingByLead.get(leadId)
      if (!prev) {
        pendingByLead.set(leadId, { leadId, appo, formAnswers: { ...formAnswers } })
      } else {
        if (appo !== undefined) prev.appo = appo
        prev.formAnswers = { ...prev.formAnswers, ...formAnswers }
      }
    }
  }

  const pendingList = [...pendingByLead.values()]

  const withPayload = pendingList.filter(
    (p) =>
      (p.appo !== undefined && p.appo !== '') || Object.keys(p.formAnswers).length > 0
  )

  for (const p of pendingList) {
    const hasWork =
      (p.appo !== undefined && p.appo !== '') || Object.keys(p.formAnswers).length > 0
    if (!hasWork) continue

    try {
      if (!execute) {
        success++
        continue
      }

      const existing = leadSourceById.get(p.leadId) ?? {}
      const prevForm =
        typeof existing.form_answers === 'object' && existing.form_answers !== null
          ? (existing.form_answers as Record<string, string>)
          : {}
      const mergedForm = { ...prevForm, ...p.formAnswers }

      const payload: Record<string, unknown> = {
        source_data: {
          ...existing,
          form_answers: mergedForm,
        },
      }
      if (p.appo !== undefined) payload.appo_detail_status = p.appo

      const { error } = await supabase.from('leads').update(payload).eq('id', p.leadId)
      if (error) throw new Error(error.message)
      success++
    } catch (e) {
      errors++
      console.error(`lead ${p.leadId}:`, e)
    }
  }

  console.log('----- 結果 -----')
  console.log(`ドライラン: ${execute ? 'いいえ' : 'はい'}`)
  console.log(
    `UPDATE対象リード（ユニークid・ペイロードあり）件数: ${withPayload.length}`
  )
  console.log(`${execute ? '成功' : 'ドライランで処理した対象'}: ${success} 件`)
  console.log(`スキップ（電話空）: ${skipNoPhone} 件`)
  console.log(`スキップ（DBに電話不一致・INSERTしない）: ${skipNoMatch} 件`)
  console.log(`スキップ（アポ・フォームとも空）: ${skipNoPayload} 件`)
  console.log(`エラー: ${errors} 件`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
