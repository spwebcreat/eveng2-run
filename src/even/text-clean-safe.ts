// G2 HUD 向け emoji サニタイズ（cleanForG2 safe wrapper）
//
// even-toolkit/text-clean の `cleanForG2` は emoji regex 範囲を広く除去し
// `.trim()` で前後空白も落とすため、本プロジェクトの HUD 静的部分（render.ts）
// に依存する以下の文字が破壊される:
//   - 媒体プレーヤー風記号: ▶ ◀
//   - ページインジケータ: ● ○
//   - 中央寄せ用の全角/半角スペース
// そのため `cleanForG2` を全面採用せず、保護したい記号を残したうえで
// default emoji presentation の文字だけを除去する safe wrapper を提供する。
//
// 仕様（v0.5-6 で bridge から呼ばれる想定）:
//   - default Emoji_Presentation=Yes の文字（🌍 など）を除去
//   - 単独で残る emoji 変異セレクタ VS16 (U+FE0F) / ZWJ (U+200D) を除去
//   - ▶◀●○ や全角/半角スペースは保持（trim しない）
//   - ASCII / CJK / かな / Geometric Shapes / Block Elements 等はそのまま通す
//
// 期待挙動（v0.5-6 で vitest 導入時にスナップショット化）:
//   cleanForG2Safe('RUN ▶')       === 'RUN ▶'
//   cleanForG2Safe('●○○') === '●○○'
//   cleanForG2Safe(' ')                === ' '
//   cleanForG2Safe('Hello 🌍') === 'Hello '
//   cleanForG2Safe('　　START ◀') === '　　START ◀'
//
// 注意: ZWJ 結合 emoji（例 🏃‍♀️ = U+1F3C3 + ZWJ + U+2640 + VS16）は U+1F3C3 のみ除去され、
// テキスト表示扱いの ♀ (U+2640, Emoji_Presentation=No) は残る。
// HUD は ASCII / CJK 中心で ZWJ シーケンスを入力に持たないため許容する。

const EMOJI_PRESENTATION = /\p{Emoji_Presentation}/gu
const EMOJI_JOINERS = /[️‍]/g

export function cleanForG2Safe(input: string): string {
  return input.replace(EMOJI_PRESENTATION, '').replace(EMOJI_JOINERS, '')
}
