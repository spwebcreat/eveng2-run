// 走行履歴のスキーマ定義
// G2 Run HUD で完走 (reset) 時に保存される 1 件分の記録

import type { Lap, RunMode } from '../run/state'

/**
 * 1 件分の走行履歴。reset 時に distanceM > 0 なら自動保存される。
 *
 * Lap[] は読み取り側で再構成可能なように readonly ではなく可変として保存（JSON 化のため）。
 * 元の RunState.laps は ReadonlyArray<Lap> だが、保存時にコピーする。
 */
export interface RunHistoryEntry {
  /** 一意 ID。timestamp ベース + ランダム要素で衝突回避。*/
  id: string
  /** 走行開始時刻（Date.now() ベース）。*/
  startedAt: number
  /** 走行終了時刻（reset 直前の Date.now()）。*/
  endedAt: number
  /** RUN / WALK。reset 直前の RunState.mode を保存。*/
  mode: RunMode
  /** 累計距離（m）。reset 直前の RunState.distanceM。*/
  distanceM: number
  /** 経過時間（ms）。reset 直前の RunState.elapsedMs。*/
  elapsedMs: number
  /** 平均ペース（秒/km）。算出不能（distance ≈ 0）なら null。*/
  averagePaceSecPerKm: number | null
  /** LAP 配列のスナップショット。*/
  laps: Lap[]
}

/**
 * 履歴コレクション全体のスキーマ。永続化先には JSON.stringify でこの形のまま保存する。
 * version は将来のマイグレーション用。現在は 1。
 */
export interface RunHistory {
  version: 1
  entries: RunHistoryEntry[]
}

/** 履歴保存件数の上限。古いものから drop する。*/
export const HISTORY_MAX_ENTRIES = 100

/** 履歴の永続化キー。SDK storage / browser localStorage 共通。*/
export const HISTORY_STORAGE_KEY = 'g2-run-hud:history:v1'

export function createEmptyHistory(): RunHistory {
  return { version: 1, entries: [] }
}
