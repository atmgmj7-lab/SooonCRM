/**
 * 電話番号を 0XX-XXXX-XXXX 形式の数字のみ文字列に正規化する。
 *
 * ルール:
 *  1. 非数字をすべて除去
 *  2. 先頭が '81' の場合は '0' に置換（例: 819012345678 → 09012345678）
 *  3. 先頭が '0' 以外かつ 10〜11桁の場合は '0' を先頭に付加（例: 9012345678 → 09012345678）
 *  4. 空文字列・nullの場合は null を返す
 */
export function normalizePhoneNumber(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (!digits) return null

  // 国際番号: 81 (Japan) → 0
  if (digits.startsWith('81') && digits.length >= 11) {
    return '0' + digits.slice(2)
  }

  // 先頭が 0 以外で 10 桁 (携帯/固定の桁落ち) → 0 を補完
  if (!digits.startsWith('0') && digits.length === 10) {
    return '0' + digits
  }

  return digits
}

/** 複数電話番号の文字列（カンマ・改行・読点区切り）をパースして正規化した配列を返す */
export function parseAndNormalizePhones(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(/[,\n、]/)
    .map((s) => normalizePhoneNumber(s.trim()))
    .filter((s): s is string => s !== null && s.length > 0)
}
