# AI学習基盤設計書（AI_LEARNING_FOUNDATION.md）
# 3層保存 + RAG + Self-Improver 学習ループ
# 2026年4月26日 統合決定版 v3

---

## 1. 設計思想

### 1.1 「データが増えるほど精度が上がる」を実現する

営業組織の1次情報（架電・受注・広告）をAIが自律学習し、
トップ営業マンの動きを再現する。エンジニアでなくても育てられるCRMにする。

### 1.2 全体構造（添付図に準拠）

```
[現実の営業活動]
  ↓ Vercel Edge Functions + Mastra Workflow（リアルタイム処理パイプライン）
  ↓ 全イベントを3方向に分岐

①構造化層 (Supabase PostgreSQL)
  - calls / leads / deals / agent_metrics

②非構造化層 (Cloudflare R2 + Supabase)
  - 音声ファイル(mp3) / 文字起こしテキスト / 操作ログJSON

③ベクトル層 (pgvector on Supabase)
  - コール内容の意味embedding / 成功パターンベクトル

  ↓ RAG検索エンジン (Mastra + pgvector)

  ↓
[3つのAIエージェント群]
- 学習・分析エージェント（成功パターンを自動抽出）
- 指示出しエージェント（アポインターへ具体的アクション提示）
- 自己改善エージェント（データが増えるほど精度が上がる）

  ↓
[アポインター画面 / SV管理画面]
```

---

## 2. 3層保存基盤

### 2.1 構造化層（Supabase PostgreSQL）

すべての営業イベントを構造化データとして保存。

**保存対象:**
- `calls`: 架電1回ごとに1レコード
- `leads`: 流入1回ごとに1レコード
- `deals`: 受注1件ごとに1レコード
- `agent_metrics`: エージェント精度の日次推移
- `agent_instructions`: AI判断の全ログ

**書き込みフロー:**

```typescript
// src/lib/events/dispatch.ts
export async function dispatchCallEvent(callData: CallEventInput) {
  const supabase = createServerSupabase();

  // 1. 構造化層に書き込み
  const { data: call } = await supabase.from('calls').insert({
    tenant_id: callData.tenantId,
    lead_id: callData.leadId,
    customer_id: callData.customerId,
    started_at: callData.startedAt,
    duration_seconds: callData.durationSeconds,
    result: callData.result,
    agent_id: callData.agentId,
  }).select().single();

  if (call) {
    // 2. 非構造化層に音声を保存（R2へアップロード）
    if (callData.audioBlob) {
      await uploadToR2(`calls/${call.id}.mp3`, callData.audioBlob);
      await supabase.from('calls').update({
        audio_r2_key: `calls/${call.id}.mp3`,
      }).eq('id', call.id);

      // 3. Trigger.dev で文字起こしジョブ起動（非同期）
      await tasks.trigger('transcribe-call', { call_id: call.id });
    }

    // 4. ベクトル層への登録は文字起こし完了後にトリガー
  }

  return call;
}
```

### 2.2 非構造化層（Cloudflare R2 + Supabase）

**音声ファイル:**
- 保存先: Cloudflare R2 (バケット: `ai-crm-os-audio`)
- パス規則: `tenants/{tenant_id}/calls/{call_id}.mp3`
- 参照: `calls.audio_r2_key`
- 取得: 署名付きURLで5分間のみ有効化

**文字起こしテキスト:**
- 保存先: Supabase `call_transcripts.full_text`
- スピーカー分離: `speaker_segments jsonb`
- AI分析結果: `summary` / `key_points` / `sentiment`

**操作ログJSON:**
- 保存先: Supabase `agent_instructions.instruction_data`
- AI判断の全文記録

### 2.3 ベクトル層（pgvector）

**目的:** 「このリードに似た過去のコール」を意味検索する。

**保存単位:** コールごとのチャンク（1コール=1〜複数チャンク）

**埋め込みモデル:** OpenAI `text-embedding-3-small`（1536次元）

**書き込みフロー:**

```typescript
// src/lib/ai/embed.ts
import { openai } from '@/lib/ai/clients';

export async function embedCallTranscript(callId: string) {
  const supabase = createServerSupabase();
  const { data: transcript } = await supabase
    .from('call_transcripts')
    .select('full_text, tenant_id, call_id')
    .eq('call_id', callId)
    .single();

  if (!transcript?.full_text) return;

  // チャンク分割（500トークン程度ごと）
  const chunks = chunkText(transcript.full_text, { maxTokens: 500, overlap: 50 });

  for (let i = 0; i < chunks.length; i++) {
    const { data: emb } = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunks[i],
    });

    await supabase.from('call_embeddings').insert({
      call_id: callId,
      tenant_id: transcript.tenant_id,
      embedding: emb.data[0].embedding,
      chunk_index: i,
      chunk_text: chunks[i],
      metadata: { token_count: chunks[i].length },
    });
  }
}
```

---

## 3. RAG検索エンジン

### 3.1 仕組み

「アポインターが架電画面を開いた瞬間に、過去の類似コールから最適スクリプトを返す」を実現。

```
[現在のリード情報]
  ↓ 埋め込み生成（業種/問い合わせ内容/状況）
  ↓
[pgvector で類似度検索]
  - 同テナント内
  - 過去30日以内
  - 採用OK / 受注したコール優先
  ↓
[上位5件の文字起こしを取得]
  ↓
[Claude Sonnet にプロンプト投入]
  「この5件の成功コールから、いま架電するスクリプトを生成して」
  ↓
[アポインター画面に表示]
```

### 3.2 実装

```typescript
// src/lib/ai/rag.ts
import { openai, claude } from '@/lib/ai/clients';

export async function generateScriptForLead(leadId: string) {
  const supabase = createServerSupabase();

  // 1. リード情報を取得
  const { data: lead } = await supabase
    .from('v_lead_with_customer')
    .select('*')
    .eq('id', leadId)
    .single();

  if (!lead) throw new Error('Lead not found');

  // 2. クエリ文字列を作成
  const query = `業種:${lead.industry} 都道府県:${lead.prefecture} 問い合わせ:${lead.inquiry_content}`;

  // 3. クエリを埋め込み化
  const { data: queryEmb } = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query,
  });

  // 4. pgvector で類似コールを検索（成功事例優先）
  const { data: similar } = await supabase.rpc('search_similar_successful_calls', {
    p_tenant_id: lead.tenant_id,
    p_query_embedding: queryEmb.data[0].embedding,
    p_limit: 5,
    p_min_similarity: 0.7,
  });

  // 5. Claude Sonnet にスクリプト生成を依頼
  const scriptPrompt = `
あなたはトップ営業マンです。以下の過去の成功コール5件を参考にして、
今からこのリードに架電する最適なスクリプトを生成してください。

【リード情報】
- 会社: ${lead.company_name}
- 業種: ${lead.industry}
- 都道府県: ${lead.prefecture}
- 問い合わせ: ${lead.inquiry_content}

【過去の成功コール】
${similar.map((c: any, i: number) => `
[${i + 1}] 業種:${c.industry} 結果:${c.result}
コール内容: ${c.chunk_text}
`).join('\n')}

【出力形式】
1. 開口一番のフック（30秒以内）
2. ニーズ確認の質問3つ
3. 想定される反論と切り返し
4. クロージング
`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: scriptPrompt }],
  });

  return response.content[0].text;
}
```

### 3.3 RPC関数（DB_SCHEMA.sqlに追加）

```sql
-- 類似成功コール検索
CREATE OR REPLACE FUNCTION search_similar_successful_calls(
  p_tenant_id uuid,
  p_query_embedding vector(1536),
  p_limit int DEFAULT 5,
  p_min_similarity float DEFAULT 0.7
)
RETURNS TABLE (
  call_id uuid,
  similarity float,
  chunk_text text,
  result text,
  industry text,
  company_name text
)
LANGUAGE sql STABLE AS $$
  SELECT
    e.call_id,
    1 - (e.embedding <=> p_query_embedding) AS similarity,
    e.chunk_text,
    c.result,
    cust.industry,
    cust.company_name
  FROM call_embeddings e
  JOIN calls c ON c.id = e.call_id
  JOIN customers cust ON cust.id = c.customer_id
  WHERE e.tenant_id = p_tenant_id
    AND c.result IN ('アポOK', '採用OK', '受注')
    AND (1 - (e.embedding <=> p_query_embedding)) >= p_min_similarity
  ORDER BY e.embedding <=> p_query_embedding
  LIMIT p_limit;
$$;
```

---

## 4. 3つのAIエージェント群

### 4.1 学習・分析エージェント

成功パターンを自動抽出し、SVに「次に必要なアクション」を提示する。

**実装:** `src/mastra/agents/self-improver.ts`

**トリガー:** データが1000件貯まるごと（cronで判定）

**処理:**

```typescript
import { Agent } from '@mastra/core';
import { claude } from '@/lib/ai/clients';

export const selfImproverAgent = new Agent({
  name: 'self-improver',
  model: 'claude-sonnet-4-20250514',
  instructions: `
あなたは営業データを分析する専門家です。
過去のコールデータから、アポ率/受注率を上げるパターンを発見してください。

分析の観点:
1. 時間帯（曜日×時間でアポ率の差はあるか）
2. 業種（業種別の温度感の違い）
3. スクリプト（どんな話し方が成果に繋がっているか）
4. 担当者（トップ層と平均層の違い）
5. 流入元（広告別の傾向）

出力形式: agent_patterns テーブルに登録できる形のJSON
`,
});

// 実行
export async function runSelfImprover(tenantId: string) {
  const supabase = createServerSupabase();

  // 過去30日のコールデータを集計
  const { data: callStats } = await supabase.rpc('get_call_pattern_stats', {
    p_tenant_id: tenantId,
    p_days: 30,
  });

  // Claude に分析を依頼
  const result = await selfImproverAgent.generate({
    messages: [
      { role: 'user', content: `次のデータから成功パターンを発見してください:\n${JSON.stringify(callStats)}` },
    ],
  });

  // パターンを agent_patterns に登録
  const patterns = parsePatterns(result.text);
  for (const p of patterns) {
    await supabase.from('agent_patterns').insert({
      tenant_id: tenantId,
      discovered_by_agent: 'self_improver',
      pattern_type: p.type,
      pattern_summary: p.summary,
      pattern_data: p.data,
      baseline_rate: p.baseline,
      improved_rate: p.improved,
      sample_size: p.sample,
      status: 'proposed',
    });
  }
}
```

### 4.2 指示出しエージェント

アポインターに「次に何をすべきか」を具体的に指示する。

**実装:** `src/mastra/agents/lead-scorer.ts` + `response-advisor.ts`

**トリガー:**
- リード登録時 → Lead Scorer（即時、自動実行）
- 架電画面表示時 → Response Advisor（リアルタイム）
- 毎朝8:00 → Call Time Optimizer（その日の架電計画）

**Lead Scorer の例:**

```typescript
import { Agent } from '@mastra/core';

export const leadScorerAgent = new Agent({
  name: 'lead-scorer',
  model: 'gemini-2.0-flash-exp', // 大量処理は安い Gemini で
  instructions: `
あなたはリードの温度感を判定する専門家です。
以下を考慮して hot/warm/cold を判定してください:

1. 問い合わせ内容のキーワード（「すぐ」「今月中」「予算」= hot）
2. 同業種の過去アポ率
3. 問い合わせ時間帯
4. 同一顧客の過去履歴（過去に受注=hot）
5. 流入元（紹介=hot、広告=その他要素次第）

出力: { temperature: "hot"|"warm"|"cold", reason: "...", priority: 0.0-1.0 }
`,
});
```

### 4.3 自己改善エージェント

データが増えるたびにエージェントの精度を計測し、ルールを自動更新する。

**実装:** `src/mastra/workflows/pattern-discovery.ts`

**ループ:**

```
1. 毎晩 cron: 当日のagent_instructionsを集計 → agent_metrics に記録
   - 各エージェントの承認率（approved / total）
   - 各エージェントの精度推移
2. 週次月曜 9:00: Self-Improverを起動
   - 過去30日の精度低下があれば原因分析
   - 新パターン発見をagent_patternsに登録
3. SVが管理画面で承認
   - 承認されたパターンが各エージェントの動作ルールに反映
4. 翌日からそのルールで動作開始
```

---

## 5. データ書き込みパイプライン

### 5.1 Vercel Edge Functions + Mastra Workflow

すべての営業イベントは `dispatchCallEvent()` 関数を経由する。
これが3層への書き込みを統一的に処理する。

```typescript
// src/lib/events/dispatch.ts
export async function dispatchCallEvent(callData: CallEventInput) {
  // 1. 構造化層
  const call = await insertCall(callData);

  // 2. 非構造化層（音声があれば）
  if (callData.audioBlob) {
    await uploadAudioToR2(call.id, callData.audioBlob);

    // 3. 文字起こし & ベクトル化を Trigger.dev で起動
    await tasks.trigger('process-call-recording', {
      call_id: call.id,
      tenant_id: callData.tenantId,
    });
  }

  // 4. リアルタイム判定（Lead Scorer）
  await leadScorerAgent.run({ leadId: callData.leadId });

  return call;
}
```

### 5.2 Trigger.dev タスク

```typescript
// src/trigger/process-call-recording.ts
import { task } from '@trigger.dev/sdk/v3';
import { transcribe } from '@/lib/ai/whisper';
import { embedCallTranscript } from '@/lib/ai/embed';
import { analyzeCallSummary } from '@/lib/ai/summarize';

export const processCallRecording = task({
  id: 'process-call-recording',
  run: async (payload: { call_id: string; tenant_id: string }) => {
    // 1. Whisper で文字起こし
    await transcribe(payload.call_id);

    // 2. Gemini Flash で要約・キーポイント抽出
    await analyzeCallSummary(payload.call_id);

    // 3. OpenAI Embeddings でベクトル化
    await embedCallTranscript(payload.call_id);
  },
});
```

---

## 6. データ蓄積率と精度の関係

```
[データ件数]   [Lead Scorer精度]   [Call Time Optimizer精度]
   100件         手動ベース        提示なし
   500件         55%               60%（時間帯のみ）
 1,000件         70%               72%
 5,000件         82%               85%
10,000件         88%               90%
```

ダッシュボードで「AI精度向上まであとXX件」を表示し、データ蓄積を可視化する。

---

## 7. ガバナンス・Human in the Loop

### 7.1 自動実行と承認必要の区別

| エージェント | 自動実行 / 承認必要 | 理由 |
|------------|------------------|------|
| Lead Scorer | 自動実行 | 即時性が必要、誤判定の影響軽微 |
| Call Time Optimizer | 自動実行 | 提示のみ、強制ではない |
| Response Advisor | 自動実行 | 提示のみ、最終判断は人間 |
| Deal Predictor | 自動実行 | 内部スコアのみ |
| Ad ROI Analyzer | 自動実行 | レポートのみ |
| Self-Improver | **承認必要** | エージェントルール変更を伴う |

### 7.2 全判断のログ化

すべてのAI判断は `agent_instructions` に記録：
- 判断内容（自然言語＋構造化）
- 判断理由（reasoning）
- 信頼度スコア
- 使用したデータ件数
- 承認/却下の履歴

---

## 8. 監視・観測

### 8.1 Langfuse 連携

Mastra のすべてのLLM呼び出しは OpenTelemetry 経由で Langfuse に送信。

```typescript
// src/lib/ai/telemetry.ts
import { LangfuseExporter } from 'langfuse-vercel';

export const langfuseExporter = new LangfuseExporter({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY!,
  secretKey: process.env.LANGFUSE_SECRET_KEY!,
  baseUrl: process.env.LANGFUSE_HOST,
});
```

Langfuseで以下を確認可能：
- LLM呼び出しのコスト推移
- レスポンスタイム
- エラー率
- プロンプト・レスポンス全文

### 8.2 Mastra Studio

エージェント単位で以下を可視化：
- 各エージェントの実行回数
- 平均実行時間
- 成功率
- 直近の失敗ログ

---

## 9. プライバシー・セキュリティ

### 9.1 PII（個人情報）の取り扱い

- 顧客の電話番号・氏名・メールアドレスは構造化層に保存
- 文字起こしには PII が含まれる可能性 → R2 へのアクセスは署名付きURL（5分有効）
- 埋め込みベクトルは数値配列のみ（PII を直接含まない）
- AIへのプロンプト送信時は、必要最小限の情報のみ含める

### 9.2 RLSの徹底

すべてのテーブルで `tenant_isolation` ポリシー適用済み（DB_SCHEMA.sql 参照）。
別テナントのデータは絶対に取得不可。

### 9.3 ログのマスキング

```typescript
// src/lib/log.ts
export function maskPii(value: string): string {
  // 電話番号
  value = value.replace(/0\d{9,10}/g, '0XX-XXXX-XXXX');
  // メール
  value = value.replace(/[\w.-]+@[\w.-]+/g, 'xxx@xxx');
  return value;
}
```

---

## 10. 関連ドキュメント

- `REQUIREMENTS.md` — 全体要件
- `DB_SCHEMA.sql` — call_transcripts / call_embeddings / agent_* の物理定義
- `METRICS_DEFINITION.md` — エージェント精度の指標定義
- `AD_MANAGER_SPEC.md` — Ad ROI Analyzer の活用先

---

_End of AI_LEARNING_FOUNDATION.md_
