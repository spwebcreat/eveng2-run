// Even Hub SDK の bridge.setLocalStorage / getLocalStorage を StoragePort として adapt する。
// - SDK の get は Promise<string>。値未設定時の戻り値は実装依存（空文字や undefined）のため、
//   空文字 / undefined は null に正規化する。
// - 例外は catch して safe な戻り値（get=null / set=false）にして throw しない。
// - 上位層は「失敗 = 履歴なし扱い」で UI を継続させる契約。
//
// 注意: bridge.getLocalStorage が「キー未設定」を空文字で返すか throw するかは SDK 内部仕様で
// 揺れるため、両方を安全側（=null）に倒す。これにより呼び出し側は JSON.parse 失敗だけ気にすれば
// よくなる。

import type { EvenAppBridge } from '@evenrealities/even_hub_sdk'
import type { StoragePort } from './ports'

/**
 * 既に resolve 済みの EvenAppBridge を受け取り、StoragePort 互換のオブジェクトを返す。
 * factory パターンにすることで bridge を内部に閉じ込め、上位層は StoragePort だけ知っていれば良い。
 */
export function createSdkStorageAdapter(bridge: EvenAppBridge): StoragePort {
  return {
    async get(key: string): Promise<string | null> {
      try {
        const raw = await bridge.getLocalStorage(key)
        // SDK の型は Promise<string> だが、未設定時に undefined / 空文字を返す可能性がある。
        // どちらも「値なし」として null に正規化する。
        if (raw === undefined || raw === null) return null
        if (typeof raw !== 'string') return null
        if (raw === '') return null
        return raw
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[g2-run-hud] sdk storage get(${key}) failed:`, msg)
        return null
      }
    },

    async set(key: string, value: string): Promise<boolean> {
      try {
        const ok = await bridge.setLocalStorage(key, value)
        // SDK が boolean を返す契約。false / 非 true は失敗扱い。
        return ok === true
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.warn(`[g2-run-hud] sdk storage set(${key}) failed:`, msg)
        return false
      }
    },
  }
}
