// RendererPort: グラス HUD の描画方式を抽象化する port。
// v0.5 では text-renderer のみ実装。v0.6 で image-renderer を experimental として
// 並走させるための土台（text/image をURLクエリ等で差し替え可能にする）。
//
// 設計（Codex 抜け漏れチェック反映で capabilities / policy / fallbackKind を含む拡張版）:
//   - capabilities: 描画方式の物理特性（更新レート上限 / 部分更新可否 / image container 使用 / スロットル）
//   - policy:       更新ポリシー（どの粒度で再描画するか / asset の供給元）
//   - fallbackKind: 失敗時のフォールバック先（image renderer が text に退避できるか。text は null）
//
// main.ts は bridge を取得した後、RendererPort.init(bridge, state) を呼ぶだけで
// 描画方式を差し替えられる（呼び出し側は kind を知らずに render/onEvent/shutdown を使う）。

import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk'
import type { RunState } from '../run/state'

export type RendererKind = 'text' | 'image'

export interface RendererCapabilities {
  /** 1 秒あたりの最大更新回数。0 = 制限なし */
  maxUpdatesPerSec: number
  /** 部分更新サポート（true: container 単位 / false: 全画面差し替え） */
  supportsPartialUpdate: boolean
  /** PNG ベース描画か（image container を使うか） */
  usesImageContainer: boolean
  /** 連続更新がドリフト / 欠落し始める閾値 (ms) */
  updateThrottleMs: number
}

export interface RenderPolicy {
  /** 再描画の粒度: lap 完了時のみ / 1Hz / 状態変化時のみ / 200ms */
  mode: 'lap-only' | '1hz' | 'on-change' | '200ms'
  /** asset / font の供給元 */
  assetSource: 'inline' | 'bundled' | 'runtime-encoded'
}

export interface RendererPort {
  readonly kind: RendererKind
  readonly capabilities: RendererCapabilities
  readonly policy: RenderPolicy
  /** 失敗時のフォールバック先 renderer kind。text 自体が最終 fallback なので null */
  readonly fallbackKind: RendererKind | null

  /** bridge に container 群を作成して描画準備する */
  init(bridge: EvenAppBridge, initialState: RunState): Promise<void>
  /** 現在 state を描画する */
  render(state: RunState, now: Date): Promise<void>
  /** G2 イベント購読（Tap / Double Tap / Scroll / Lifecycle）。unsubscribe を返す */
  onEvent(handler: (event: EvenHubEvent) => void): () => void
  /** 終了処理（unsubscribe + shutdown）。exitMode 既定 0（自動 cleanup） */
  shutdown(exitMode?: number): Promise<void>
}
