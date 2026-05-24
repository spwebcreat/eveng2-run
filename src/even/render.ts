// G2 HUD container 別 content 生成（純関数）
// - v0.2.3: アイコン廃止 + 3x3 グリッドレイアウト
//   上段: 経過時間 / 距離 / 日付時刻
//   中央: メッセージ表示領域
//   下段: 心拍数 / 平均ペース / ステータス（媒体プレーヤー風記号 RUN ▶ / PAUSE ||）
// - 副作用なし。state.ts / format.ts のみに依存

import { CONTAINER_IDS, type RenderMap } from './bridge'
import type { RunState } from '../run/state'
import { formatDistance, formatPace, formatTime } from '../run/format'

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
 * ステータスラベル（媒体プレーヤー風記号付き）。
 * Frame 34 のデザインに準拠:
 *   - running → "RUN ▶"
 *   - paused  → "PAUSE ||"
 *   - idle    → "READY ▶"   （スタート待ち）
 *   - gps-waiting → "GPS"
 *   - error   → "ERROR"
 *   - lap     → "LAP"
 */
function statusLabel(state: RunState): string {
  switch (state.screenMode) {
    case 'running':
      return 'RUN ▶'
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
      return 'READY ▶'
  }
}

/**
 * 心拍表示（MVP では常に "-- bpm"）
 */
function heartRateText(state: RunState): string {
  if (state.heartRateBpm === null || !Number.isFinite(state.heartRateBpm)) return '-- bpm'
  return `${Math.round(state.heartRateBpm)} bpm`
}

/**
 * 中央メッセージ領域の内容を決定。
 * - idle: "START ◀"（タップで開始の視覚的ヒント・スタート時のみ）
 * - paused: "END   ダブルタップで終了"（ダブルタップで idle に戻すアナウンス）
 * - lap 表示中: ラップ情報 + ランダムメッセージ
 * - エラー時: エラー詳細
 * - GPS 待ち時: 誘導文
 * - 通常走行中: 直近ラップ message（あれば、無ければ空白）
 */
function messageText(state: RunState): string {
  if (state.screenMode === 'error') {
    return state.errorMessage ?? '位置情報を取得できません'
  }
  if (state.screenMode === 'gps-waiting') {
    return '空が見える場所へ移動してください'
  }
  if (state.screenMode === 'lap') {
    const lap = state.laps[state.laps.length - 1]
    if (!lap) return ' '
    const lapPace = lap.lapTimeMs > 0 ? formatPace(lap.lapTimeMs / 1000) : "--'--\""
    const avgPace = formatPace(lap.averagePaceSecPerKm)
    const msg = lap.message ?? ''
    return `LAP ${lap.km}  ${lapPace} / AVG ${avgPace}\n${msg}`
  }
  if (state.screenMode === 'idle') {
    return 'START ◀'
  }
  if (state.screenMode === 'paused') {
    return 'END   ダブルタップで終了'
  }
  // running: 直近ラップの message があれば残す（無ければ空白）
  return state.message ?? ' '
}

/**
 * 現在 state から container 別 content を生成する。
 * @param state  RunState
 * @param now    現在時刻（DI でテスト容易性確保）
 */
export function renderForState(state: RunState, now: Date = new Date()): RenderMap {
  const map = new Map<number, string>()

  // 上段: 経過時間 / 距離 / 日付・時刻
  map.set(CONTAINER_IDS.textTime, `経過時間\n${formatTime(state.elapsedMs)}`)
  map.set(CONTAINER_IDS.textDistance, `距離\n${formatDistance(state.distanceM)} km`)
  map.set(CONTAINER_IDS.textClock, formatClockHeader(now))

  // 中央: メッセージ表示領域
  map.set(CONTAINER_IDS.textMessage, messageText(state))

  // 下段: 心拍数 / 平均ペース / ステータス
  map.set(CONTAINER_IDS.textHr, `心拍数\n${heartRateText(state)}`)
  map.set(CONTAINER_IDS.textPace, `平均ペース\n${formatPace(state.averagePaceSecPerKm)}/km`)
  map.set(CONTAINER_IDS.textStatus, statusLabel(state))

  // 透明イベントキャプチャ container は content 空白のまま（初回 attach 時の ' ' 設定で十分）
  // 毎フレーム再送すると無駄なので明示的に map に入れない（bridge 側で「未指定=維持」になる）

  return map
}
