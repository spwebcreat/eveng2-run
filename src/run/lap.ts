// ラップ検知ユーティリティ
// distanceM が 1km の倍数に到達したかを判定し、Lap を生成する

import type { Lap, RunState } from './state'
import { averagePaceSecPerKm } from './pace'
import { pickRandomMessage } from './messages'

/**
 * 現在距離が次のラップ閾値を超えたかを判定し、
 * 超えた場合は Lap オブジェクトを生成して返す。超えていなければ null。
 *
 * @param state 現在の RunState（distanceM / elapsedMs / currentLapKm / laps を参照）
 */
export function detectLap(state: RunState): Lap | null {
  const nextLapKm = state.currentLapKm + 1
  const thresholdM = nextLapKm * 1000
  if (state.distanceM < thresholdM) return null

  // 前回ラップ時の elapsedMs を取得（なければ 0）
  const prevElapsedMs =
    state.laps.length > 0 ? (state.laps[state.laps.length - 1]?.elapsedMs ?? 0) : 0
  const lapTimeMs = state.elapsedMs - prevElapsedMs

  const avgPace = averagePaceSecPerKm(state.distanceM, state.elapsedMs) ?? 0

  return {
    km: nextLapKm,
    distanceM: state.distanceM,
    elapsedMs: state.elapsedMs,
    lapTimeMs: lapTimeMs > 0 ? lapTimeMs : state.elapsedMs,
    averagePaceSecPerKm: avgPace,
    message: pickRandomMessage(),
  }
}
