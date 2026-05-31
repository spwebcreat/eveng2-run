// URL クエリ ?renderer=image で image renderer に切替（v0.6 で実装予定）。
// v0.5 では image renderer 未実装のため、要求されても text renderer にフォールバックし、
// 呼び出し側にフォールバック理由 (fallbackNote) を返して status 表示させる。
//
// 既存挙動（クエリなし）は text renderer で起動 = v0.4.0 と完全に同じ。

import { createTextRenderer } from './text-renderer'
import type { RendererPort } from './renderer-port'

export interface RendererSelection {
  renderer: RendererPort
  /** 要求された renderer がフォールバックされた場合の説明（なければ null） */
  fallbackNote: string | null
}

export function selectRenderer(search: string = location.search): RendererSelection {
  const requested = new URLSearchParams(search).get('renderer')
  if (requested === 'image') {
    // v0.6 で image-renderer.ts を実装したらここで分岐する。
    return {
      renderer: createTextRenderer(),
      fallbackNote: 'image renderer 未実装（v0.6 予定）のため text で起動',
    }
  }
  return { renderer: createTextRenderer(), fallbackNote: null }
}
