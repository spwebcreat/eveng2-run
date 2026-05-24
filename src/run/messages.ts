// ラップ時に表示するランダムメッセージ（日本語固定・MVP 10 候補）

export const RUN_MESSAGES: readonly string[] = [
  'いいリズム！',
  '肩の力を抜こう',
  '次の1kmだけ集中',
  '呼吸を整える',
  'ナイスラン！',
  'フォーム意識',
  '無理せず淡々と',
  'このペースでOK',
  '腕振りを軽く',
  'あと少し集中',
]

/**
 * RUN_MESSAGES からランダムに 1 件選ぶ
 * - 配列が空の場合は空文字を返す（防御）
 */
export function pickRandomMessage(): string {
  if (RUN_MESSAGES.length === 0) return ''
  const i = Math.floor(Math.random() * RUN_MESSAGES.length)
  return RUN_MESSAGES[i] ?? ''
}
