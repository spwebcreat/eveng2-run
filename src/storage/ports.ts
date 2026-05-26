// StoragePort: KV 永続化の抽象インターフェース
// - Hub 接続時: SDK の bridge.setLocalStorage / getLocalStorage を adapt
// - Hub 未接続 / dev 環境: browser localStorage を adapt
//
// すべて async 契約に統一（SDK 側は Promise を返すため）。

/**
 * 永続化先の抽象。get/set のシンプルな KV API。
 * 実装は src/storage/sdk-adapter.ts / browser-adapter.ts を参照。
 */
export interface StoragePort {
  /**
   * key に対応する値を取得する。存在しない / 読み取り失敗時は null を返す。
   * throw はしない（呼び出し側で console.warn して空状態に fall back する想定）。
   */
  get(key: string): Promise<string | null>

  /**
   * key に value を保存する。失敗時は false を返す（throw はしない）。
   */
  set(key: string, value: string): Promise<boolean>
}
