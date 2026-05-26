// 走行履歴の永続化操作（load / append / clear）。
// - StoragePort 経由でやり取りし、ストレージ実装には依存しない。
// - JSON 破損 / version mismatch / 取得失敗時は createEmptyHistory() に fallback し、UI を壊さない。
// - append は MAX_ENTRIES (100) を超えたら末尾（=最古）から drop する。

import {
  createEmptyHistory,
  HISTORY_MAX_ENTRIES,
  HISTORY_STORAGE_KEY,
  type RunHistory,
  type RunHistoryEntry,
} from './types'
import type { StoragePort } from './ports'

/**
 * 履歴を取得する。存在しない / JSON 破損 / version mismatch なら空履歴を返す。
 * - throw しない（失敗時は console.warn のみ）
 */
export async function loadHistory(port: StoragePort): Promise<RunHistory> {
  const raw = await port.get(HISTORY_STORAGE_KEY)
  if (raw === null) return createEmptyHistory()

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[g2-run-hud] history JSON parse failed, falling back to empty:', msg)
    return createEmptyHistory()
  }

  if (!isRunHistory(parsed)) {
    console.warn('[g2-run-hud] history schema mismatch, falling back to empty')
    return createEmptyHistory()
  }

  return parsed
}

/**
 * 履歴に 1 件追加して保存する。
 * - 新エントリは先頭（index 0）に挿入（新しい順）
 * - MAX_ENTRIES を超える分は末尾（最古）から drop
 * - 保存失敗は console.warn 出して in-memory の更新値だけ返す
 * @returns 更新後の RunHistory
 */
export async function appendHistory(
  port: StoragePort,
  entry: RunHistoryEntry,
): Promise<RunHistory> {
  const current = await loadHistory(port)
  const nextEntries = [entry, ...current.entries].slice(0, HISTORY_MAX_ENTRIES)
  const next: RunHistory = { version: 1, entries: nextEntries }

  const ok = await port.set(HISTORY_STORAGE_KEY, JSON.stringify(next))
  if (!ok) {
    console.warn('[g2-run-hud] history append save failed; returning in-memory value only')
  }
  return next
}

/**
 * 履歴を全消去する。version=1 / entries=[] を保存。
 * - 失敗時は console.warn のみ（throw しない）
 */
export async function clearHistory(port: StoragePort): Promise<void> {
  const empty = createEmptyHistory()
  const ok = await port.set(HISTORY_STORAGE_KEY, JSON.stringify(empty))
  if (!ok) {
    console.warn('[g2-run-hud] history clear save failed')
  }
}

/**
 * RunHistory 形状の構造的検証。
 * - version === 1
 * - entries が Array
 * 中身の各 entry の field 妥当性までは検証しない（前方互換性のため寛容に扱う）。
 */
function isRunHistory(value: unknown): value is RunHistory {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { version?: unknown; entries?: unknown }
  if (v.version !== 1) return false
  if (!Array.isArray(v.entries)) return false
  return true
}
