import { createAdminClient } from '@/lib/supabase/admin'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

type ListRecord = {
  id: string
  customer_id: string | null
  company_name: string | null
  representative_name: string | null
  title: string | null
  prefecture: string | null
  address: string | null
  phone_numbers: string[] | null
  company_email: string | null
  last_call_result: string | null
  last_call_count: number | null
  recall_date: string | null
  status: string | null
  inquiry_count: number | null
  last_inquiry_at: string | null
  last_inquiry_ad_name: string | null
  fm_record_id: string | null
  fm_modification_id: string | null
  created_at: string
  updated_at: string | null
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-2.5 border-b" style={{ borderColor: 'var(--color-gray-100)' }}>
      <span className="w-36 shrink-0 text-[12px]" style={{ color: 'var(--color-gray-400)' }}>{label}</span>
      <span className="text-[13px]" style={{ color: 'var(--color-gray-900)' }}>{value ?? '—'}</span>
    </div>
  )
}

export default async function ListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = createAdminClient()

  const { data: rec, error } = await supabase
    .from('list_records')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !rec) notFound()

  const record = rec as ListRecord

  return (
    <div className="p-8" style={{ background: 'var(--color-gray-50)', minHeight: '100%' }}>
      <div className="mb-6">
        <Link
          href="/list"
          className="inline-flex items-center gap-1 text-[12px] mb-3"
          style={{ color: 'var(--color-gray-400)' }}
        >
          <ChevronLeft size={13} />
          リスト情報に戻る
        </Link>
        <h1 className="text-[22px] font-bold" style={{ color: 'var(--color-gray-900)' }}>
          {record.company_name ?? '（会社名なし）'}
        </h1>
        {record.customer_id && (
          <p className="text-[12px] mt-0.5 tabular-nums" style={{ color: 'var(--color-gray-400)' }}>
            {record.customer_id}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6" style={{ maxWidth: 800 }}>
        <section className="rounded-xl border p-6" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
          <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-gray-600)' }}>基本情報</h2>
          <Row label="会社名" value={record.company_name} />
          <Row label="代表名" value={record.representative_name} />
          <Row label="役職" value={record.title} />
          <Row label="都道府県" value={record.prefecture} />
          <Row label="住所" value={record.address} />
          <Row label="電話番号" value={record.phone_numbers?.join(' / ')} />
          <Row label="メール" value={record.company_email} />
        </section>

        <section className="rounded-xl border p-6" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
          <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-gray-600)' }}>架電・対応状況</h2>
          <Row label="最終架電結果" value={record.last_call_result} />
          <Row label="コール数" value={record.last_call_count} />
          <Row label="再コール日" value={record.recall_date} />
          <Row label="ステータス" value={record.status} />
        </section>

        <section className="rounded-xl border p-6" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
          <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-gray-600)' }}>問い合わせ履歴</h2>
          <Row label="総問い合わせ数" value={record.inquiry_count ?? 0} />
          <Row label="最終問い合わせ日" value={record.last_inquiry_at?.slice(0, 10)} />
          <Row label="最終広告名" value={record.last_inquiry_ad_name} />
        </section>

        <section className="rounded-xl border p-6" style={{ borderColor: 'var(--color-gray-200)', background: 'var(--color-white)' }}>
          <h2 className="text-[13px] font-semibold mb-3" style={{ color: 'var(--color-gray-600)' }}>FM同期情報</h2>
          <Row label="FM Record ID" value={record.fm_record_id} />
          <Row label="FM Mod ID" value={record.fm_modification_id} />
          <Row label="作成日時" value={record.created_at?.slice(0, 16).replace('T', ' ')} />
          <Row label="更新日時" value={record.updated_at?.slice(0, 16).replace('T', ' ')} />
        </section>
      </div>
    </div>
  )
}
