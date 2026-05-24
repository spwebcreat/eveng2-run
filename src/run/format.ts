// 表示用フォーマッタ（純関数）
// G2 HUD と コンパニオン UI の両方で使うため副作用なし

/**
 * ペース秒/km を "5'42\"" 形式に整形する
 * - 値が null / 0 / Infinity / NaN の場合は "--'--\""
 * - 整数秒に丸めて mm'ss" 表記
 */
export function formatPace(secPerKm: number | null): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "--'--\""
  }
  const total = Math.round(secPerKm)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}'${String(s).padStart(2, '0')}"`
}

/**
 * 経過時間 ms を "mm:ss" もしくは "hh:mm:ss" 形式に整形
 * - 1 時間未満は mm:ss、1 時間以上は h:mm:ss
 * - 負値・NaN は "00:00"
 */
export function formatTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/**
 * 距離 m を "3.24" 形式（小数点 2 桁の km）に整形
 * - 負値・NaN は "0.00"
 */
export function formatDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters < 0) return '0.00'
  const km = meters / 1000
  return km.toFixed(2)
}

/**
 * 心拍数 bpm を "HR -- bpm" or "HR 142 bpm" に整形
 * - MVP では常に "HR -- bpm"（heartRateBpm は null 固定）
 */
export function formatHeartRate(bpm: number | null): string {
  if (bpm === null || !Number.isFinite(bpm)) return 'HR -- bpm'
  return `HR ${Math.round(bpm)} bpm`
}
