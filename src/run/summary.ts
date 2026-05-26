// LAP サマリ算出ユーティリティ
// laps 配列から最速 / 最遅 / 平均ペースを pure に算出する

import type { Lap } from './state'

export interface LapSummary {
  /** 最速 LAP（lapTimeMs 最小）。laps 空なら null。*/
  fastest: Lap | null
  /** 最遅 LAP（lapTimeMs 最大）。laps 空なら null。*/
  slowest: Lap | null
  /** 全 LAP の平均ペース（秒/km）。laps 空なら null。*/
  averagePaceSecPerKm: number | null
}

/**
 * LAP 配列からサマリを算出する。pure 関数。
 * 1 LAP しかなければ fastest と slowest は同じ Lap を指す。
 */
export function selectLapSummary(laps: ReadonlyArray<Lap>): LapSummary {
  if (laps.length === 0) {
    return { fastest: null, slowest: null, averagePaceSecPerKm: null }
  }

  let fastest: Lap = laps[0]!
  let slowest: Lap = laps[0]!
  let paceSum = 0
  let paceCount = 0

  for (const lap of laps) {
    if (lap.lapTimeMs < fastest.lapTimeMs) fastest = lap
    if (lap.lapTimeMs > slowest.lapTimeMs) slowest = lap
    if (lap.averagePaceSecPerKm > 0) {
      paceSum += lap.averagePaceSecPerKm
      paceCount += 1
    }
  }

  const averagePaceSecPerKm = paceCount > 0 ? paceSum / paceCount : null
  return { fastest, slowest, averagePaceSecPerKm }
}
