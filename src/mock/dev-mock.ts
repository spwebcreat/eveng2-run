// テストモード用のダミー位置情報ジェネレータ
// 1 秒ごとに 2.78m 加算（キロ 6 分相当 = 10 km/h）
// 緯度方向に直線で進ませる（lng は固定）

import type { GeoPosition } from '../run/state'

const STEP_M_PER_SEC = 2.78 // ≒ 10 km/h ≒ 6 分/km

// 緯度 1 度 = 約 111_000 m なので、1 秒あたりの緯度増分（度）は STEP_M_PER_SEC / 111_000
const STEP_DEG_PER_SEC = STEP_M_PER_SEC / 111_000

// 初期位置（東京駅付近の適当な座標・GPS フォーマット確認用なので位置精度不要）
const ORIGIN_LAT = 35.6812
const ORIGIN_LNG = 139.7671

export interface MockRunHandle {
  stop: () => void
}

export interface MockRunOptions {
  onPosition: (pos: GeoPosition) => void
  intervalMs?: number // 既定 1000ms
}

/**
 * テストモード用ダミー位置ジェネレータを開始する
 * - intervalMs ごとに位置を 1 step ぶん進めて onPosition を呼ぶ
 * - 初期位置は queueMicrotask 経由で非同期発火（F8 同型の同期 callout 再帰を防止）
 */
export function startMockRun(options: MockRunOptions): MockRunHandle {
  const { onPosition, intervalMs = 1000 } = options
  let elapsedSec = 0
  let stopped = false

  // 同期 callout を避けるため初期発火も queueMicrotask に逃がす。
  // 同期で onPosition を呼ぶと、呼び元の `mockHandle = startMockRun(...)` の
  // 代入完了前に store.emit → subscribe → syncPositionSourceFor へ再入し、
  // mockHandle === null 判定が成立して startMockRun が多重起動する
  // （setInterval も多重に走り、距離計算が 0 のまま固まる）。
  queueMicrotask(() => {
    if (stopped) return
    onPosition({
      lat: ORIGIN_LAT,
      lng: ORIGIN_LNG,
      accuracy: 0,
      timestamp: Date.now(),
    })
  })

  const timerId = setInterval(() => {
    if (stopped) return
    elapsedSec += intervalMs / 1000
    const lat = ORIGIN_LAT + elapsedSec * STEP_DEG_PER_SEC
    onPosition({
      lat,
      lng: ORIGIN_LNG,
      accuracy: 0,
      timestamp: Date.now(),
    })
  }, intervalMs)

  return {
    stop: () => {
      stopped = true
      clearInterval(timerId)
    },
  }
}
