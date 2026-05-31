// Settings スキーマと既定値。
// v0.5 では plain な型 + localStorage 永続化のみ（UI は companion の素 HTML パネル）。
// v0.7 で React 化する際もこの型を再利用する想定。

import type { RunMode } from '../run/state'

/** 距離・ペースの表示単位。metric = km / imperial = mile。 */
export type DistanceUnit = 'metric' | 'imperial'

export interface Settings {
  /** 距離・ペースの表示単位 */
  unit: DistanceUnit
  /** 目標ペース（秒/km）。null = 無効。v0.6 で Target pace 差分表示に使う（v0.5 は保存のみ）。*/
  targetPaceSecPerKm: number | null
  /** GPS 高精度モード（geolocation の enableHighAccuracy） */
  highAccuracyGps: boolean
  /** READY 時の表示モード初期値（run / walk） */
  initialMode: RunMode
}

export const DEFAULT_SETTINGS: Settings = {
  unit: 'metric',
  targetPaceSecPerKm: null,
  highAccuracyGps: true,
  initialMode: 'run',
}

export const SETTINGS_STORAGE_KEY = 'g2-run-hud:settings:v1'

/** 目標ペースの許容範囲（4'00〜10'00 / km）。範囲外は clamp、null はそのまま。 */
export const TARGET_PACE_MIN_SEC = 240
export const TARGET_PACE_MAX_SEC = 600

export function clampTargetPace(sec: number | null): number | null {
  if (sec === null || !Number.isFinite(sec)) return null
  return Math.min(TARGET_PACE_MAX_SEC, Math.max(TARGET_PACE_MIN_SEC, Math.round(sec)))
}

/**
 * 任意の unknown を Settings に正規化する（壊れた値は既定値で埋める）。
 * 永続化データの前方/後方互換のため、不明フィールドは無視し欠損は既定値で補完する。
 */
export function parseSettings(raw: unknown): Settings {
  if (typeof raw !== 'object' || raw === null) return { ...DEFAULT_SETTINGS }
  const v = raw as Record<string, unknown>
  return {
    unit: v.unit === 'imperial' ? 'imperial' : 'metric',
    targetPaceSecPerKm:
      typeof v.targetPaceSecPerKm === 'number' ? clampTargetPace(v.targetPaceSecPerKm) : null,
    highAccuracyGps: typeof v.highAccuracyGps === 'boolean' ? v.highAccuracyGps : true,
    initialMode: v.initialMode === 'walk' ? 'walk' : 'run',
  }
}
