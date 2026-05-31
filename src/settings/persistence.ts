// Settings の永続化（load / save）。StoragePort 経由でストレージ実装に依存しない。
// - Hub 接続時: SDK localStorage / dev: browser localStorage（run-history と同じ仕組み）
// - 破損 / 欠損時は既定値に fallback（throw しない）

import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY, parseSettings, type Settings } from './schema'
import type { StoragePort } from '../storage/ports'

/** Settings を読み込む。存在しない / JSON 破損時は既定値を返す。 */
export async function loadSettings(port: StoragePort): Promise<Settings> {
  const raw = await port.get(SETTINGS_STORAGE_KEY)
  if (raw === null) return { ...DEFAULT_SETTINGS }
  try {
    return parseSettings(JSON.parse(raw))
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[g2-run-hud] settings JSON parse failed, using defaults:', msg)
    return { ...DEFAULT_SETTINGS }
  }
}

/** Settings を保存する。失敗時は false（throw しない）。 */
export async function saveSettings(port: StoragePort, settings: Settings): Promise<boolean> {
  const ok = await port.set(SETTINGS_STORAGE_KEY, JSON.stringify(settings))
  if (!ok) console.warn('[g2-run-hud] settings save failed')
  return ok
}
