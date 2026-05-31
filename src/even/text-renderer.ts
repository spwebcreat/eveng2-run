// text-renderer: 既存の bridge (attachG2Hud) + render (renderForState) を
// RendererPort 実装にまとめたもの。v0.4.0 までの挙動を完全に維持する（regression なし）。
//
// capabilities: G2 text container は textContainerUpgrade で container 単位の部分更新が可能。
//   実測上 1Hz 程度の更新で運用しており、連続高頻度更新は SDK 負荷になるため updateThrottleMs は控えめ。
// policy:       状態変化時のみ再描画（dedup は bridge 側の lastSent で実施済み）。asset は inline（PNG 非使用）。
// fallbackKind: null（text 自体が最終フォールバック先）。

import type { EvenAppBridge, EvenHubEvent } from '@evenrealities/even_hub_sdk'
import { attachG2Hud, type ExitMode, type G2HudHandle } from './bridge'
import { renderForState } from './render'
import type { RunState } from '../run/state'
import type { DisplayUnit } from '../run/format'
import type { RendererCapabilities, RenderPolicy, RendererPort } from './renderer-port'

const TEXT_CAPABILITIES: RendererCapabilities = {
  maxUpdatesPerSec: 1,
  supportsPartialUpdate: true,
  usesImageContainer: false,
  updateThrottleMs: 50,
}

const TEXT_POLICY: RenderPolicy = {
  mode: 'on-change',
  assetSource: 'inline',
}

export function createTextRenderer(): RendererPort {
  let handle: G2HudHandle | null = null

  return {
    kind: 'text',
    capabilities: TEXT_CAPABILITIES,
    policy: TEXT_POLICY,
    fallbackKind: null,

    async init(bridge: EvenAppBridge, initialState: RunState): Promise<void> {
      const initialMap = renderForState(initialState, new Date())
      handle = await attachG2Hud(bridge, initialMap)
    },

    async render(state: RunState, now: Date, unit: DisplayUnit = 'metric'): Promise<void> {
      if (handle === null) return
      await handle.render(renderForState(state, now, unit))
    },

    onEvent(handler: (event: EvenHubEvent) => void): () => void {
      if (handle === null) return () => {}
      return handle.onEvent(handler)
    },

    async shutdown(exitMode = 0): Promise<void> {
      if (handle === null) return
      const h = handle
      handle = null
      await h.shutdown((exitMode === 1 ? 1 : 0) as ExitMode)
    },
  }
}
