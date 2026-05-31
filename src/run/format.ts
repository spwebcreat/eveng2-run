// 表示用フォーマッタ（純関数）
// G2 HUD と コンパニオン UI の両方で使うため副作用なし
// v0.5: 単位（metric=km / imperial=mile）に対応。unit 省略時は metric = 従来挙動を完全維持。

/** 表示単位。metric = km / imperial = mile。 */
export type DisplayUnit = 'metric' | 'imperial'

const METERS_PER_MILE = 1609.344

/** 距離の単位ラベル（"km" / "mi"）。 */
export function distanceUnitLabel(unit: DisplayUnit = 'metric'): string {
  return unit === 'imperial' ? 'mi' : 'km'
}

/** ペースの単位ラベル（"/km" / "/mi"）。 */
export function paceUnitLabel(unit: DisplayUnit = 'metric'): string {
  return unit === 'imperial' ? '/mi' : '/km'
}

/**
 * ペース秒/km を "5'42\"" 形式に整形する
 * - 値が null / 0 / Infinity / NaN の場合は "--'--\""
 * - 整数秒に丸めて mm'ss" 表記
 * - unit=imperial では 秒/mile に換算して表記
 */
export function formatPace(secPerKm: number | null, unit: DisplayUnit = 'metric'): string {
  if (secPerKm === null || !Number.isFinite(secPerKm) || secPerKm <= 0) {
    return "--'--\""
  }
  const perUnit = unit === 'imperial' ? secPerKm * (METERS_PER_MILE / 1000) : secPerKm
  const total = Math.round(perUnit)
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
 * 距離 m を "3.24" 形式（小数点 2 桁）に整形
 * - 負値・NaN は "0.00"
 * - unit=metric は km、imperial は mile に換算
 */
export function formatDistance(meters: number, unit: DisplayUnit = 'metric'): string {
  if (!Number.isFinite(meters) || meters < 0) return '0.00'
  const value = unit === 'imperial' ? meters / METERS_PER_MILE : meters / 1000
  return value.toFixed(2)
}

// formatHeartRate は v0.5 で内蔵心拍 UI 削除に伴い撤去（SDK に HR API なし）。
// v0.9 で BLE 外部 HR を採用する際は externalHr (RunState) 用の整形関数を新設する。
