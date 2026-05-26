// G2 入力イベントを RunStore のアクションに振り分ける
// - sysEvent: tap (CLICK_EVENT) / double-tap (DOUBLE_CLICK_EVENT) / lifecycle 系 / scroll (R1 リング)
// - textEvent: scroll (SCROLL_TOP / SCROLL_BOTTOM)・tap 系（実機 SDK 仕様揺れ対策）
// - Protobuf zero-value omit 対策: payload が存在する場合のみ eventType を CLICK_EVENT(0) に coalesce
//   payload 自体が存在しない場合は undefined を維持して空イベントを Tap と誤判定しない
//
// Phase 2:
// - SCROLL_TOP / SCROLL_BOTTOM を以下にマッピング:
//     READY (idle) 中: mode toggle (RUN ⇄ WALK)
//     running / paused 中: page cycle (prev / next)
// - sysEvent の場合は EventSourceType.TOUCH_EVENT_FROM_RING で R1 リング由来を厳密判別できる。
// - textEvent には eventSource フィールドが無いため、実機ログ確認までは「textEvent の scroll も
//   リング由来と仮定」して保守的に処理する。これで誤動作リスクは「リング以外の入力が SCROLL_TOP
//   /BOTTOM を送ってくる場合」に限定されるが、現状そのような経路は判明していない。
// - 関数先頭でイベント payload を console.debug でダンプする（旦那様の実機ログ確認用）。
//   R1 リング判別の payload shape が確定したら削除予定の dev 用導線。

import { EventSourceType, OsEventTypeList, type EvenHubEvent } from '@evenrealities/even_hub_sdk'
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
 *   - SCROLL_TOP / SCROLL_BOTTOM  → mode toggle (READY) / page cycle (running, paused)
 *                                   ※ eventSource === TOUCH_EVENT_FROM_RING のもののみ反応
 *   - FOREGROUND_ENTER / EXIT     → MVP では無視（将来拡張用フック）
 * - textEvent 系（sysEvent が無い場合のみ）
 *   - SCROLL_TOP / SCROLL_BOTTOM  → mode toggle / page cycle（リング由来と仮定）
 *   - DOUBLE_CLICK / CLICK        → 念のため対応（実機 SDK 仕様の揺れ吸収）
 */
export function routeEvent(event: EvenHubEvent, options: InputRouterOptions): void {
  const { store, onSystemExit } = options

  // dev 用デバッグ導線: R1 リング由来の payload shape が確定するまで残す
  // 本番では noisy になるため、実機ログ確認後に削除予定。
  try {
    console.debug('[g2-run-hud] event', JSON.stringify(event))
  } catch {
    // 循環参照等で JSON.stringify が失敗する可能性に備え silently fall through
  }

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

    // SCROLL: R1 リング由来のみ反応する（眼鏡側 touch との衝突を避ける）
    if (
      sysType === OsEventTypeList.SCROLL_TOP_EVENT ||
      sysType === OsEventTypeList.SCROLL_BOTTOM_EVENT
    ) {
      const source = event.sysEvent.eventSource
      if (source !== EventSourceType.TOUCH_EVENT_FROM_RING) {
        // R1 リング以外（左右眼鏡 touch / dummy）からの scroll は無視
        return
      }
      handleScroll(store, sysType)
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

    // SCROLL: textEvent には eventSource が無いため、リング由来と仮定して保守的に処理
    if (
      textType === OsEventTypeList.SCROLL_TOP_EVENT ||
      textType === OsEventTypeList.SCROLL_BOTTOM_EVENT
    ) {
      handleScroll(store, textType)
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

/**
 * SCROLL_TOP / SCROLL_BOTTOM を現在の status に応じてアクションに変換する。
 * - idle (READY): RUN ⇄ WALK トグル（top / bottom どちらでもトグル）
 * - running / paused: page cycle（top = prev / bottom = next）
 */
function handleScroll(store: RunStore, scrollType: OsEventTypeList): void {
  const status = store.getState().status
  if (status === 'idle') {
    store.toggleMode()
    return
  }
  // running / paused
  if (scrollType === OsEventTypeList.SCROLL_TOP_EVENT) {
    store.cyclePage('prev')
    return
  }
  if (scrollType === OsEventTypeList.SCROLL_BOTTOM_EVENT) {
    store.cyclePage('next')
    return
  }
}
