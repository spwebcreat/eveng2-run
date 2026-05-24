// G2 入力イベントを RunStore のアクションに振り分ける
// - sysEvent: tap (CLICK_EVENT) / double-tap (DOUBLE_CLICK_EVENT) / lifecycle 系
// - textEvent: scroll (SCROLL_TOP / SCROLL_BOTTOM)
// - Protobuf zero-value omit 対策: payload が存在する場合のみ eventType を CLICK_EVENT(0) に coalesce
//   payload 自体が存在しない場合は undefined を維持して空イベントを Tap と誤判定しない

import { OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
import type { RunStore } from '../run/state'

export interface InputRouterOptions {
  store: RunStore
  onSystemExit?: () => void
}

/**
 * EvenHubEvent → RunStore アクション へのルーター
 * - sysEvent 系（payload 存在）
 *   - SYSTEM_EXIT / ABNORMAL_EXIT → onSystemExit
 *   - DOUBLE_CLICK_EVENT          → Reset（running 中は state 側でガード）
 *   - CLICK_EVENT (Tap)           → Start / Pause トグル
 *   - FOREGROUND_ENTER / EXIT     → MVP では無視（将来拡張用フック）
 * - textEvent 系（payload 存在・sysEvent が無い場合のみ）
 *   - SCROLL_TOP / SCROLL_BOTTOM  → MVP では無視
 *   - DOUBLE_CLICK / CLICK        → 念のため対応（実機 SDK 仕様の揺れ吸収）
 */
export function routeEvent(event: EvenHubEvent, options: InputRouterOptions): void {
  const { store, onSystemExit } = options

  if (event.sysEvent) {
    // Protobuf zero-value omit 対策: eventType が undefined なら CLICK_EVENT(0) として扱う
    const sysType = event.sysEvent.eventType ?? OsEventTypeList.CLICK_EVENT

    // ライフサイクル系は最優先
    if (
      sysType === OsEventTypeList.SYSTEM_EXIT_EVENT ||
      sysType === OsEventTypeList.ABNORMAL_EXIT_EVENT
    ) {
      onSystemExit?.()
      return
    }

    // Double-tap: Reset（mvp 仕様）
    if (sysType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      store.reset()
      return
    }

    // Tap: Start / Pause トグル
    if (sysType === OsEventTypeList.CLICK_EVENT) {
      store.toggleStartPause()
      return
    }

    // FOREGROUND_ENTER / FOREGROUND_EXIT は将来の自動再開・自動停止用フック
    if (
      sysType === OsEventTypeList.FOREGROUND_ENTER_EVENT ||
      sysType === OsEventTypeList.FOREGROUND_EXIT_EVENT
    ) {
      return
    }

    // 未知の sysEvent は無視
    return
  }

  if (event.textEvent) {
    // Protobuf zero-value omit 対策: eventType が undefined なら CLICK_EVENT(0) として扱う
    const textType = event.textEvent.eventType ?? OsEventTypeList.CLICK_EVENT

    // SCROLL_TOP / SCROLL_BOTTOM は MVP では無視（将来拡張用）
    if (
      textType === OsEventTypeList.SCROLL_TOP_EVENT ||
      textType === OsEventTypeList.SCROLL_BOTTOM_EVENT
    ) {
      return
    }

    // 実機 SDK 仕様の揺れ吸収: textEvent から DOUBLE_CLICK / CLICK が来た場合も対応
    if (textType === OsEventTypeList.DOUBLE_CLICK_EVENT) {
      store.reset()
      return
    }
    if (textType === OsEventTypeList.CLICK_EVENT) {
      store.toggleStartPause()
      return
    }

    return
  }

  // payload が無い空イベントは無視（Tap と誤判定しない）
}
