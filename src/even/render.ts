// G2 HUD container 別 content 生成（純関数）
// - v0.2.3: アイコン廃止 + 3x3 グリッドレイアウト
//   上段: 経過時間 / 距離 / 日付時刻
//   中央: メッセージ表示領域
//   下段: 心拍数 / 平均ペース / ステータス（媒体プレーヤー風記号 RUN ▶ / PAUSE ||）
// - Phase 2: currentPage に応じて Page 1 / 2 / 3 を切り替え
//     Page 1 = HUD（既存挙動を完全維持）
//     Page 2 = LAP 直近 3 件リスト（中央 message に集約・上下段は ' ' で隠す）
//     Page 3 = LAP サマリ（BEST / SLOW / AVG・中央 message に集約・上下段は ' ' で隠す）
//   ただし screenMode === 'lap'（ラップ通知中）は currentPage に関わらず Page 1 を表示する。
//   既存のラップ通知 UX（6 秒間ハイライト）を妨げないため。
// - 副作用なし。state.ts / format.ts / summary.ts のみに依存

import { CONTAINER_IDS, type RenderMap } from './bridge'
import type { RunState, Lap, PageId } from '../run/state'
import {
  formatDistance,
  formatPace,
  formatTime,
  distanceUnitLabel,
  paceUnitLabel,
  type DisplayUnit,
} from '../run/format'
import { selectLapSummary } from '../run/summary'

/**
 * 「5月24日  10:36」フォーマット（漢字含む・最も読める）
 * Frame 33 の右上日時表示と一致。
 */
export function formatClockHeader(now: Date): string {
  const month = now.getMonth() + 1
  const day = now.getDate()
  const hours = String(now.getHours()).padStart(2, '0')
  const minutes = String(now.getMinutes()).padStart(2, '0')
  return `${month}月${day}日  ${hours}:${minutes}`
}

/**
 * ステータスラベル（媒体プレーヤー風記号付き・mode 反映）。
 *   - running, mode=run  → "RUN ▶"
 *   - running, mode=walk → "WALK ▶"
 *   - paused             → "PAUSE ||"
 *   - idle, mode=run     → "READY ▶ RUN"   （スタート待ち + 現在モード）
 *   - idle, mode=walk    → "READY ▶ WALK"  （R1 リングで切替可）
 *   - gps-waiting        → "GPS"
 *   - error              → "ERROR"
 *   - lap                → "LAP"
 */
function statusLabel(state: RunState): string {
  switch (state.screenMode) {
    case 'running':
      return state.mode === 'walk' ? 'WALK ▶' : 'RUN ▶'
    case 'paused':
      return 'PAUSE ||'
    case 'gps-waiting':
      return 'GPS'
    case 'error':
      return 'ERROR'
    case 'lap':
      return 'LAP'
    case 'idle':
    default:
      return state.mode === 'walk' ? 'READY ▶ WALK' : 'READY ▶ RUN'
  }
}

/**
 * ページインジケータ（右端ドット 3 つでカレントを示す）。
 *   Page 1 → ●○○
 *   Page 2 → ○●○
 *   Page 3 → ○○●
 * fullwidth bullet (●○) は 4-bit gray ディスプレイでも明確に区別可能。
 */
function pageIndicator(page: PageId): string {
  switch (page) {
    case 1:
      return '●○○'
    case 2:
      return '○●○'
    case 3:
      return '○○●'
  }
}

/**
 * 下段右の textStatus に流す content: ステータス + ページインジケータ。
 * 例: "RUN ▶  ●○○"
 */
function statusWithPage(state: RunState): string {
  return `${statusLabel(state)}  ${pageIndicator(state.currentPage)}`
}

/**
 * 中央メッセージ領域の内容を決定。
 * - idle: "START ◀"（タップで開始の視覚的ヒント・中央寄せ）
 * - paused: "END   長押しで終了"（長押しは G2 ハードレベルでアプリ終了するため文言のみ・中央寄せ）
 * - lap 表示中: ラップ情報 + ランダムメッセージ
 * - エラー時: エラー詳細
 * - GPS 待ち時: 誘導文
 * - 通常走行中: 直近ラップ message（あれば、無ければ空白）
 *
 * 中央寄せ方法:
 *   G2 SDK の TextContainerProperty はアラインメントプロパティを持たないため、
 *   leading に全角スペース (U+3000 ≈ 32px 幅) を入れて視覚的に中央寄せを近似する。
 *   container 幅 496px / padding 4px → 有効幅 488px。
 *   実機 font は proportional のため厳密な中央配置は不可。実機確認後に微調整可。
 */
function messageText(state: RunState, unit: DisplayUnit): string {
  if (state.screenMode === 'error') {
    return state.errorMessage ?? '位置情報を取得できません'
  }
  if (state.screenMode === 'gps-waiting') {
    return '空が見える場所へ移動してください'
  }
  if (state.screenMode === 'lap') {
    const lap = state.laps[state.laps.length - 1]
    if (!lap) return ' '
    const lapPace = lap.lapTimeMs > 0 ? formatPace(lap.lapTimeMs / 1000, unit) : "--'--\""
    const avgPace = formatPace(lap.averagePaceSecPerKm, unit)
    const msg = lap.message ?? ''
    return `LAP ${lap.km}  ${lapPace} / AVG ${avgPace}\n${msg}`
  }
  if (state.screenMode === 'idle') {
    // START ◀ は短いので全角スペース 7 個で中央寄せ近似
    return '　　　　　　　START ◀'
  }
  if (state.screenMode === 'paused') {
    // 長押しは G2 ハードレベルでアプリ終了する挙動（SYSTEM_EXIT_EVENT 受信 → cleanup）
    return '　　END   長押しで終了'
  }
  // running: 直近ラップの message があれば残す（無ければ空白）
  return state.message ?? ' '
}

/**
 * Page 2: LAP 直近 3 件のリスト表示用文字列。
 * - laps が空: 案内文 2 行
 * - laps が 1+ 件: 新しい順に最大 3 件、各行 `LAP n  m'ss" / AVG m'ss"`
 * 1 ヶ所の text container (textMessage) に \n 区切りで詰める。
 */
function lapListText(laps: ReadonlyArray<Lap>, unit: DisplayUnit): string {
  if (laps.length === 0) {
    return 'LAP 履歴なし\n1km走るとここに表示されます'
  }
  // 新しい順 = 末尾から最大 3 件
  const recent = laps.slice(-3).reverse()
  const lines = recent.map((lap) => {
    const lapPace = lap.lapTimeMs > 0 ? formatPace(lap.lapTimeMs / 1000, unit) : "--'--\""
    const avgPace = formatPace(lap.averagePaceSecPerKm, unit)
    return `LAP ${lap.km}  ${lapPace} / AVG ${avgPace}`
  })
  return lines.join('\n')
}

/**
 * Page 3: LAP サマリ表示用文字列。
 * - laps が空: 案内文 2 行
 * - laps が 1+ 件: BEST / SLOW / AVG の 3 行
 *   位置揃え目的でラベルは半角スペースで桁を揃える（proportional font なので近似）。
 */
function lapSummaryText(laps: ReadonlyArray<Lap>, unit: DisplayUnit): string {
  const summary = selectLapSummary(laps)
  if (summary.fastest === null || summary.slowest === null) {
    return 'サマリなし\n1km以上走ると表示されます'
  }
  const bestPace =
    summary.fastest.lapTimeMs > 0 ? formatPace(summary.fastest.lapTimeMs / 1000, unit) : "--'--\""
  const slowPace =
    summary.slowest.lapTimeMs > 0 ? formatPace(summary.slowest.lapTimeMs / 1000, unit) : "--'--\""
  const avgPace = formatPace(summary.averagePaceSecPerKm, unit)
  return [
    `BEST  LAP ${summary.fastest.km}   ${bestPace}`,
    `SLOW  LAP ${summary.slowest.km}   ${slowPace}`,
    `AVG          ${avgPace}`,
  ].join('\n')
}

/**
 * Page 1 (HUD) の RenderMap を構築。既存挙動を完全維持。
 */
function renderPage1(state: RunState, now: Date, unit: DisplayUnit): RenderMap {
  const map = new Map<number, string>()

  // 上段: 経過時間 / 距離 / 日付・時刻
  map.set(CONTAINER_IDS.textTime, `経過時間\n${formatTime(state.elapsedMs)}`)
  map.set(
    CONTAINER_IDS.textDistance,
    `距離\n${formatDistance(state.distanceM, unit)} ${distanceUnitLabel(unit)}`,
  )
  map.set(CONTAINER_IDS.textClock, formatClockHeader(now))

  // 中央: メッセージ表示領域
  map.set(CONTAINER_IDS.textMessage, messageText(state, unit))

  // 下段: 平均ペース / ステータス（mode + ページインジケータ込み）。
  // 下段左 (旧 心拍) は v0.5 で削除。container ID 15 は v0.9 BLE 外部 HR 表示用に予約。
  map.set(
    CONTAINER_IDS.textPace,
    `平均ペース\n${formatPace(state.averagePaceSecPerKm, unit)}${paceUnitLabel(unit)}`,
  )
  map.set(CONTAINER_IDS.textStatus, statusWithPage(state))

  // 透明イベントキャプチャ container は content 空白のまま（初回 attach 時の ' ' 設定で十分）
  // 毎フレーム再送すると無駄なので明示的に map に入れない（bridge 側で「未指定=維持」になる）

  return map
}

/**
 * Page 2 / 3 共通: 上下段 5 container を半角スペース ' ' で隠し、中央 message + 下段右ステータスを更新する。
 * - 下段右 textStatus はステータス + ページインジケータの表示を維持（ユーザーが現在ページを把握できる）
 * - bridge 側で空文字 '' は ' ' に変換されるが、ここでは明示的に ' ' を送って意図を明確にする。
 */
function renderCenterOnly(state: RunState, centerText: string): RenderMap {
  const map = new Map<number, string>()
  const blank = ' '
  map.set(CONTAINER_IDS.textTime, blank)
  map.set(CONTAINER_IDS.textDistance, blank)
  map.set(CONTAINER_IDS.textClock, blank)
  map.set(CONTAINER_IDS.textMessage, centerText)
  map.set(CONTAINER_IDS.textPace, blank)
  // ステータス + ページインジケータは Page 2/3 でも表示（現在ページを示すため）
  map.set(CONTAINER_IDS.textStatus, statusWithPage(state))
  return map
}

/**
 * 現在 state から container 別 content を生成する。
 * @param state  RunState
 * @param now    現在時刻（DI でテスト容易性確保）
 */
export function renderForState(
  state: RunState,
  now: Date = new Date(),
  unit: DisplayUnit = 'metric',
): RenderMap {
  // lap 通知中は currentPage に関わらず Page 1 表示優先（既存ラップ通知 UX を妨げない）
  if (state.screenMode === 'lap') {
    return renderPage1(state, now, unit)
  }

  const page: PageId = state.currentPage
  if (page === 2) {
    return renderCenterOnly(state, lapListText(state.laps, unit))
  }
  if (page === 3) {
    return renderCenterOnly(state, lapSummaryText(state.laps, unit))
  }
  // page === 1 (default)
  return renderPage1(state, now, unit)
}
