export const ALL_METRICS = [
  // ── リスト集計 ──────────────────────
  { key: 'leads',             label: 'リスト数（リード数）',      category: 'list', chartType: 'bar'  },
  { key: 'appo',              label: 'アポOK数',                 category: 'list', chartType: 'bar'  },
  { key: 'chosei',            label: '調整中（リスク/商談前）',   category: 'list', chartType: 'bar'  },
  { key: 'saiyoOk',          label: '採用OK（商談着座）',        category: 'list', chartType: 'bar'  },
  { key: 'saiyoNg',          label: '採用NG',                  category: 'list', chartType: 'bar'  },
  { key: 'juchu',             label: '受注',                    category: 'list', chartType: 'bar'  },
  { key: 'chakuza',           label: '着座数（採用OK+受注）',     category: 'list', chartType: 'bar'  },
  { key: 'ng',                label: 'NG',                      category: 'list', chartType: 'bar'  },
  { key: 'taishogai',         label: '対象外',                  category: 'list', chartType: 'bar'  },
  { key: 'kanryo',            label: '完了',                    category: 'list', chartType: 'bar'  },
  { key: 'mikanryo',          label: '未完了',                  category: 'list', chartType: 'bar'  },
  { key: 'miCall',            label: '未コール',                category: 'list', chartType: 'bar'  },
  { key: 'rusu',              label: '留守',                    category: 'list', chartType: 'bar'  },
  { key: 'mikomiA',           label: '見込みA',                 category: 'list', chartType: 'bar'  },
  { key: 'mikomiB',           label: '見込みB',                 category: 'list', chartType: 'bar'  },
  { key: 'mikomiC',           label: '見込みC',                 category: 'list', chartType: 'bar'  },
  // ── 率指標 ──────────────────────────
  { key: 'appoRate',          label: '対リストアポ率',           category: 'rate', chartType: 'line' },
  { key: 'appoRateKanryo',    label: '対完了アポ率',            category: 'rate', chartType: 'line' },
  { key: 'chakuzaRateList',   label: '対リスト着座率',           category: 'rate', chartType: 'line' },
  { key: 'chakuzaRateAppo',   label: '対アポ着座率',            category: 'rate', chartType: 'line' },
  { key: 'chakuzaRateKanryo', label: '対完了着座率',            category: 'rate', chartType: 'line' },
  { key: 'juchuRateShodan',   label: '対商談OK受注率',          category: 'rate', chartType: 'line' },
  { key: 'juchuRateList',     label: '対リスト受注率',           category: 'rate', chartType: 'line' },
  { key: 'kanryoRate',        label: 'リスト完了率',             category: 'rate', chartType: 'line' },
  // ── 広告指標 ────────────────────────
  { key: 'clicks',            label: 'クリック',                category: 'ad',   chartType: 'bar'  },
  { key: 'reach',             label: 'リーチ',                  category: 'ad',   chartType: 'bar'  },
  { key: 'impressions',       label: 'インプレッション',         category: 'ad',   chartType: 'bar'  },
  { key: 'cpa',               label: 'CPA（1L単価）',           category: 'ad',   chartType: 'bar'  },
  { key: 'ctr',               label: 'CTR',                     category: 'ad',   chartType: 'line' },
  { key: 'cpc',               label: 'CPC',                     category: 'ad',   chartType: 'bar'  },
  { key: 'cpm',               label: 'CPM',                     category: 'ad',   chartType: 'bar'  },
  { key: 'adSpend',           label: '広告費',                  category: 'ad',   chartType: 'bar'  },
  { key: 'cpaPerAppo',        label: '1アポ当たり単価',          category: 'ad',   chartType: 'bar'  },
  { key: 'cpaPerChakuza',     label: '1採用当たり単価',          category: 'ad',   chartType: 'bar'  },
  { key: 'cpo',               label: '1受注あたり広告費(CPO)',   category: 'ad',   chartType: 'bar'  },
  { key: 'totalRevenue',      label: '総受注額',                category: 'ad',   chartType: 'bar'  },
  { key: 'roasTotal',         label: 'ROAS（総受注）',          category: 'ad',   chartType: 'line' },
  { key: 'roasCashflow',      label: 'ROAS（入金額）',          category: 'ad',   chartType: 'line' },
] as const

export type MetricKey = typeof ALL_METRICS[number]['key']

export const DEFAULT_METRICS: MetricKey[] = ['leads', 'appo', 'kanryo', 'appoRate', 'kanryoRate']
