# リード情報 x FM紐づけ 実装指示書 -- sooon-crm
# このファイルをClaude Codeに渡して実行させること
# FM_SYNC_CLAUDE_CODE_PROMPT.md の実装完了後に着手すること

## 概要

webhook_leads（Meta広告リード）とFMとの紐づけは以下2フローで発生する。

フローA: 既存顧客リードの場合
  Meta広告 -> webhook_leads（pending）
  -> 電話番号照合 -> list_records に一致
  -> match_status = 'matched' / added_to_list_id セット
  -> FM同期後に fm_record_id も伝播

フローB: 新規リードの場合
  Meta広告 -> webhook_leads（pending）
  -> 電話番号照合 -> 一致なし -> match_status = 'unmatched'
  -> 手動承認 -> list_records 新規作成
  -> FM同期後に fm_record_id がセットされる

## STEP 1: webhook_leadsテーブルにカラム追加（Supabase SQLで実行）

ALTER TABLE webhook_leads
  ADD COLUMN IF NOT EXISTS fm_record_id text,
  ADD COLUMN IF NOT EXISTS fm_synced_at timestamptz,
  ADD COLUMN IF NOT EXISTS phone_normalized text,
  ADD COLUMN IF NOT EXISTS match_status text NOT NULL DEFAULT 'pending';
-- match_status: matched / unmatched / pending

CREATE INDEX IF NOT EXISTS idx_webhook_leads_phone_norm ON webhook_leads(phone_normalized);
CREATE INDEX IF NOT EXISTS idx_webhook_leads_match_status ON webhook_leads(match_status);
CREATE INDEX IF NOT EXISTS idx_webhook_leads_fm_record ON webhook_leads(fm_record_id);

## STEP 2: Webhook受信時の自動照合
ファイル: src/app/api/webhooks/meta/route.ts を修正

webhook_leads insert の直後に電話番号照合を追加する。

  const rawPhone = payload.phone_number ?? payload['電話番号'] ?? payload.phone ?? '';
  const phoneNormalized = normalizePhone(String(rawPhone));

  const { data: matched } = await supabase
    .from('list_records')
    .select('id, customer_id, fm_record_id')
    .eq('tenant_id', TENANT_ID)
    .contains('phone_numbers', JSON.stringify([phoneNormalized]))
    .limit(1)
    .maybeSingle();

  const matchStatus = phoneNormalized ? (matched ? 'matched' : 'unmatched') : 'pending';

  const { data: insertedLead } = await supabase
    .from('webhook_leads')
    .insert({
      tenant_id: TENANT_ID,
      raw_data: payload,
      ad_name: payload['広告名'] ?? payload.ad_name,
      source: 'meta_ads',
      phone_normalized: phoneNormalized,
      match_status: matchStatus,
      ...(matched ? {
        status: 'added',
        added_to_list_id: matched.id,
        added_at: new Date().toISOString(),
      } : {}),
    })
    .select('id')
    .single();

  if (matched && insertedLead) {
    await supabase
      .from('list_records')
      .update({ webhook_lead_id: insertedLead.id, updated_at: new Date().toISOString() })
      .eq('id', matched.id);
  }

## STEP 3: FM同期時に webhook_leads.fm_record_id も更新
ファイル: src/lib/filemaker/sync.ts を修正

syncListRecords() 内のupsert後に以下を追加。

  // upsert に .select('id, webhook_lead_id') を追加
  const { data: upsertedRecord, error } = await supabase
    .from('list_records')
    .upsert({ ... }, { onConflict: 'fm_record_id' })
    .select('id, webhook_lead_id')
    .single();

  if (upsertedRecord?.webhook_lead_id) {
    await supabase
      .from('webhook_leads')
      .update({ fm_record_id: fmRecordId, fm_synced_at: new Date().toISOString() })
      .eq('id', upsertedRecord.webhook_lead_id)
      .is('fm_record_id', null);
  }

## STEP 4: /leads 画面にFM紐づけ状態を表示
ファイル: src/app/(dashboard)/leads/page.tsx を修正

テーブルカラムを以下に変更:
  問い合わせ日 | 広告名 | 会社名 | 代表名 | 電話番号 | 都道府県 |
  FM紐づけ状態（追加） | リスト情報（追加） | ステータス | 操作

FM紐づけ状態バッジ（4種）:
  fm_record_id あり           -> 緑バッジ「FM同期済」
  added_to_list_id あり のみ  -> 青バッジ「リスト紐づき済」
  match_status = 'unmatched'  -> 黄バッジ「未紐づけ」
  match_status = 'pending'    -> 灰バッジ「照合待ち」

リスト情報リンク列:
  added_to_list_id がある場合 -> /list/[id] へのリンク（CS番号 + 会社名）
  ない場合 -> ダッシュ表示

## STEP 5: /leads フィルターにFM紐づけ状態を追加

選択肢: すべて / FM同期済 / リスト紐づき済 / 未紐づけ / 照合待ち

Supabaseクエリへの反映:
  fm_synced  -> .not('fm_record_id', 'is', null)
  linked     -> .not('added_to_list_id', 'is', null).is('fm_record_id', null)
  unmatched  -> .eq('match_status', 'unmatched')
  pending    -> .eq('match_status', 'pending')

## STEP 6: 手動再照合API（新規作成）
ファイル: src/app/api/leads/rematch/route.ts

FM同期後など、既存の unmatched リードを一括再照合するAPI。
POST /api/leads/rematch を実行すると:
  1. match_status='unmatched' かつ phone_normalized があるレコードを全取得
  2. 各レコードの phone_normalized で list_records を照合
  3. 一致したものを matched に更新し added_to_list_id をセット
  4. list_records.webhook_lead_id もセット
  5. { matched: N, total: M } を返す

/leads 画面に「未紐づけを再照合」ボタンを追加:
  クリック -> POST /api/leads/rematch -> router.refresh()

## データフロー全体図

  Meta広告
    -> Webhook受信
  webhook_leads（insert）
    -> phone_normalized 生成 -> 即時照合
    |
    +- 一致 -> match_status='matched', added_to_list_id セット
    |          list_records.webhook_lead_id セット
    |
    +- 不一致 -> match_status='unmatched'
                 -> 手動承認 or「未紐づけを再照合」ボタン
                 -> list_records に紐づけ

  FM同期（syncListRecords 実行時）
    -> list_records.fm_record_id セット
    -> webhook_leads.fm_record_id にも伝播

## 確認チェックリスト

  [ ] webhook_leadsに 4カラム（fm_record_id / fm_synced_at / phone_normalized / match_status）追加
  [ ] Webhook受信時に phone_normalized が自動セットされる
  [ ] Webhook受信時に照合が走り match_status が自動セットされる
  [ ] 一致時 added_to_list_id と list_records.webhook_lead_id が双方向で紐づく
  [ ] FM同期後 webhook_leads.fm_record_id に値が入る
  [ ] /leads に「FM紐づけ状態」カラムが表示される
  [ ] 4種バッジが正しく出る
  [ ] 「FM紐づけ状態」でフィルタリングできる
  [ ] リスト情報列クリックで /list/[id] に遷移できる
  [ ] POST /api/leads/rematch が動作する
  [ ] 「未紐づけを再照合」ボタンが動作する

---
sooon-crm リード情報xFM紐づけ実装指示 -- 2026-04-30
