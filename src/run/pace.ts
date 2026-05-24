// ペース計算ユーティリティ（純関数）
// 平均ペース: 全体距離と経過時間から算出
// 現在ペース: 直近の position サンプル群から算出（MVP では平均ペースで代替可）

import type { GeoPosition } from './state'

/**
 * 平均ペース（秒/km）を算出
 * - 距離 0 / 経過時間 0 の場合は null
 */
export function averagePaceSecPerKm(distanceM: number, elapsedMs: number): number | null {
  if (distanceM <= 0 || elapsedMs <= 0) return null
  const elapsedSec = elapsedMs / 1000
  const km = distanceM / 1000
  return elapsedSec / km
}

/**
 * 現在ペース（直近 N 秒の移動から）
 * - windowMs: 直近何 ms ぶんの positions を採用するか（既定 30 秒）
 * - minDistanceM: 計算成立に必要な最小移動距離（既定 50m。誤差で爆発するペース防止）
 * - positions が足りない / 移動が少ない場合は null
 *
 * MVP では平均ペース表示で十分なので未使用可。将来拡張用フック。
 */
export function currentPaceSecPerKm(
  positions: readonly GeoPosition[],
  windowMs = 30_000,
  minDistanceM = 50,
): number | null {
  if (positions.length < 2) return null
  const latest = positions[positions.length - 1]
  if (!latest) return null

  const cutoff = latest.timestamp - windowMs
  // window 内の最古サンプルを探す
  let earliest: GeoPosition | null = null
  for (const p of positions) {
    if (p.timestamp >= cutoff) {
      earliest = p
      break
    }
  }
  if (!earliest || earliest === latest) return null

  // window 内の移動距離を累積
  let dist = 0
  let prev = earliest
  for (const p of positions) {
    if (p.timestamp < earliest.timestamp) continue
    if (p === earliest) {
      prev = p
      continue
    }
    dist += haversineDistanceM(prev, p)
    prev = p
  }

  if (dist < minDistanceM) return null
  const dtMs = latest.timestamp - earliest.timestamp
  if (dtMs <= 0) return null

  const sec = dtMs / 1000
  const km = dist / 1000
  return sec / km
}

/**
 * Haversine formula で 2 点間の距離（m）を算出
 * - 公開（lap.ts / geolocation.ts でも使う）
 */
export function haversineDistanceM(a: GeoPosition, b: GeoPosition): number {
  const R = 6_371_000 // 地球半径 m
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2)
  return 2 * R * Math.asin(Math.sqrt(h))
}
