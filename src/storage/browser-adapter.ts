// window.localStorage を StoragePort として包む adapter。
// - Hub 未接続 / dev サーバ（vite）/ companion ページなど bridge が無い経路で使う。
// - SDK adapter と同様に throw しない契約。失敗は null / false で表現する。
// - SSR / Worker など window が無い環境でも import がエラーにならないよう typeof で guard する。

import type { StoragePort } from './ports'

/**
 * window.localStorage を adapt した StoragePort を返す。
 * window / localStorage が利用不可能な実行環境では get=null / set=false を返すダミーになる。
 */
export function createBrowserStorageAdapter(): StoragePort {
  // typeof で window / localStorage の利用可否を判定（SSR safe）
  const ls: Storage | null =
    typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
      ? window.localStorage
      : null

  return {
    async get(key: string): Promise<string | null> {
      if (ls === null) return null
      try {
        const raw = ls.getItem(key)
        return raw === null || raw === '' ? null : raw
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[g2-run-hud] browser storage get(${key}) failed:`, msg)
        return null
      }
    },

    async set(key: string, value: string): Promise<boolean> {
      if (ls === null) return false
      try {
        ls.setItem(key, value)
        return true
      } catch (err: unknown) {
        // QuotaExceededError / SecurityError 等
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[g2-run-hud] browser storage set(${key}) failed:`, msg)
        return false
      }
    },
  }
}
