// 走行履歴のスキーマ定義
// G2 Run HUD で完走 (reset) 時に保存される 1 件分の記録

import type { Lap, RunMode } from '../run/state'

/**
 * GPX 書き出し用の走行中サンプリング点（schema v2 で追加）。
 * 走行中 5 秒ごとに 1 点記録する。v0.4.0 までの古い履歴には存在しない（undefined）。
 */
export interface TrackPoint {
  /** epoch ms */
  t: number
  lat: number
  lon: number
  /** GPS 高度（m）。取得できなければ undefined。*/
  ele?: number
  /** その時点の現在ペース（秒/km）。算出不能なら undefined。*/
  pace?: number
}

/**
 * 1 件分の走行履歴。reset 時に distanceM > 0 なら自動保存される。
 *
 * Lap[] は読み取り側で再構成可能なように readonly ではなく可変として保存（JSON 化のため）。
 * 元の RunState.laps は ReadonlyArray<Lap> だが、保存時にコピーする。
 *
 * schema v2（v0.5）で schemaVersion / trackpoints を追加。両方とも optional にして
 * v0.4.0 までの古いデータ（schemaVersion / trackpoints 無し）をそのまま読み込めるようにする。
 */
export interface RunHistoryEntry {
  /** 一意 ID。timestamp ベース + ランダム要素で衝突回避。*/
  id: string
  /** エントリの schema バージョン。v0.5 以降の新規保存は 2。古いデータは undefined（=1 扱い）。*/
  schemaVersion?: 2
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
  /** 走行中の GPS サンプリング点（schema v2）。古いデータは undefined。*/
  trackpoints?: TrackPoint[]
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
