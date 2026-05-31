// EvenAppBridge ラッパー（v0.2.3: アイコン廃止 + 3x3 グリッドレイアウト）
// - waitForBridge       : waitForEvenAppBridge をラップ（副作用なし。Promise.race で timeout 競争可能）
// - attachG2Hud         : 既に解決済の bridge に container 群を作成して handle を返す
//
// 設計意図:
//   v0.2.x で 4-bit gray アイコン → PNG アイコンと試したが、24x24 でも視認性 / デザインの両面で
//   実機 G2 に最適化しきれなかった。v0.2.3 でアイコンを廃止し、純テキスト 3x3 グリッド構成へ。
//   ステータスは媒体プレーヤー風（RUN ▶ / PAUSE ||）の記号テキストで視覚的にわかりやすく。
//
// 重要な制約:
//   `isEventCapture: 1` は host 側 validation で「multiple event listeners (>1) not allowed」と
//   ハネられるため、**画面全体に 1 個だけ** 透明イベントキャプチャ container を置き、
//   他 text container は全て `isEventCapture: 0` で表示専用にする。
//
// コンテナ構成（text 7 / image 0 / total 7 / containerTotalNum 1~12）:
//   Text  T0: 透明イベントキャプチャ          位置 (x=0,    y=0,   w=576, h=288, isEventCapture=1)
//   Text  T1: 経過時間（上段左）              位置 (x=4,    y=8,   w=180, h=80)
//   Text  T2: 距離（上段中）                  位置 (x=200,  y=8,   w=180, h=80)
//   Text  T3: 日付・時刻（上段右）            位置 (x=394,  y=8,   w=178, h=80)
//   Text  T4: メッセージ表示領域（中央）      位置 (x=40,   y=110, w=496, h=70)
//   Text  T6: 平均ペース（下段中）            位置 (x=200,  y=200, w=180, h=80)
//   Text  T7: ステータス（下段右・記号付き）  位置 (x=394,  y=200, w=178, h=80)
//   ※ v0.5 で 心拍（旧 T5・下段左 x=4,y=200）を削除。container ID 15 は v0.9 BLE 外部 HR 表示用に予約。

import {
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  waitForEvenAppBridge,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk'
import { cleanForG2Safe } from './text-clean-safe'

// ---- 画面定数 ----
const BORDER_COLOR = 0 // 公式 image テンプレ準拠（borderWidth=0 でも縦線が見える事故を回避）
const PADDING = 4

// ---- container ID 定義（再描画時に参照） ----
export const CONTAINER_IDS = {
  textEvents: 10, // 透明・全画面 isEventCapture 専用（content は空白 1 文字）
  textTime: 11,
  textDistance: 12,
  textClock: 13,
  textMessage: 14,
  // 15 は v0.5 で削除した心拍表示の ID。v0.9 BLE 外部 HR 表示で復活予定のため予約（再利用しない）
  textPace: 16,
  textStatus: 17,
} as const

export type ContainerId = (typeof CONTAINER_IDS)[keyof typeof CONTAINER_IDS]

/**
 * 各 text container の幾何情報。content は render.ts から動的に注入する。
 * isEventCapture を true にできるのは **events 用 1 個だけ**（host validation 制約）。
 */
interface TextSlot {
  id: number
  name: string
  xPosition: number
  yPosition: number
  width: number
  height: number
  isEventCapture: boolean
}

const SCREEN_WIDTH = 576
const SCREEN_HEIGHT = 288

const TEXT_SLOTS: ReadonlyArray<TextSlot> = [
  // 全画面イベントキャプチャ（透明・最背面・content 空白 1 文字）
  {
    id: CONTAINER_IDS.textEvents,
    name: 'g2-events',
    xPosition: 0,
    yPosition: 0,
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    isEventCapture: true,
  },
  // 上段: 経過時間 / 距離 / 日時
  { id: CONTAINER_IDS.textTime, name: 'g2-time', xPosition: 4, yPosition: 8, width: 180, height: 80, isEventCapture: false },
  { id: CONTAINER_IDS.textDistance, name: 'g2-dist', xPosition: 200, yPosition: 8, width: 180, height: 80, isEventCapture: false },
  { id: CONTAINER_IDS.textClock, name: 'g2-clock', xPosition: 394, yPosition: 8, width: 178, height: 80, isEventCapture: false },
  // 中央: メッセージ表示領域
  { id: CONTAINER_IDS.textMessage, name: 'g2-msg', xPosition: 40, yPosition: 110, width: 496, height: 70, isEventCapture: false },
  // 下段: 平均ペース / ステータス（下段左 x=4 は v0.5 で心拍削除につき空き・v0.9 BLE HR 用に確保）
  { id: CONTAINER_IDS.textPace, name: 'g2-pace', xPosition: 200, yPosition: 200, width: 180, height: 80, isEventCapture: false },
  { id: CONTAINER_IDS.textStatus, name: 'g2-status', xPosition: 394, yPosition: 200, width: 178, height: 80, isEventCapture: false },
]

// shutDownPageContainer の exitMode:
//   0 = 即時退出（自動 cleanup / unload 時）
//   1 = 前面で確認 dialog を出してユーザー判断（明示ユーザー終了）
export type ExitMode = 0 | 1

/**
 * render.ts から bridge へ渡す描画指示。
 * text container は ID をキーに content をマップ。指定がない ID は前回値を維持する（再送しない）。
 */
export type RenderMap = ReadonlyMap<number, string>

export interface G2HudHandle {
  /** 各 text container に content を送信する。前回と同一の content は再送スキップ */
  render: (map: RenderMap) => Promise<void>
  /** G2 のイベント購読（Tap / Double Tap / Scroll / Lifecycle） */
  onEvent: (handler: (event: EvenHubEvent) => void) => () => void
  /** 終了処理（unsubscribe + shutdown）。exitMode 既定 0（自動 cleanup） */
  shutdown: (exitMode?: ExitMode) => Promise<void>
}

/**
 * Step 1/2: bridge 取得のみ実施（副作用なし）。
 * - timeout 競争に使える
 * - container は別 step（attachG2Hud）で作成する
 */
export async function waitForBridge(): Promise<EvenAppBridge> {
  return waitForEvenAppBridge()
}

/**
 * Step 2/2: 既に解決済の bridge に container 群を作成して handle を返す。
 * - text 8 個（events 1 + 表示 7）の純テキスト構成
 * - 起動失敗（result != 0）は throw
 */
export async function attachG2Hud(
  bridge: EvenAppBridge,
  initialTexts: RenderMap,
): Promise<G2HudHandle> {
  // text container 群（isEventCapture は events 専用 slot のみ 1）
  // 初期 content は半角スペース ' ' をデフォルトに。空文字 '' だと SDK が「変更なし」と
  // 解釈して既存テキストが残るケースがある（特に textContainerUpgrade で後から空にしたい場面）。
  // 公式 image テンプレに倣い、events 専用 container は paddingLength=0、表示用は 4。
  // v0.5-6: emoji / 未対応 Unicode を SDK へ渡す前に除去（▶◀●○ や空白は保護する safe wrapper）。
  // 除去後に空文字になったら半角スペースで送る（空文字は SDK が「変更なし」扱いにして前回値が残るため）。
  const sanitize = (s: string): string => {
    const cleaned = cleanForG2Safe(s)
    return cleaned === '' ? ' ' : cleaned
  }

  const textObjects = TEXT_SLOTS.map(
    (slot) =>
      new TextContainerProperty({
        xPosition: slot.xPosition,
        yPosition: slot.yPosition,
        width: slot.width,
        height: slot.height,
        borderWidth: 0,
        borderColor: BORDER_COLOR,
        paddingLength: slot.isEventCapture ? 0 : PADDING,
        containerID: slot.id,
        containerName: slot.name,
        content: sanitize(initialTexts.get(slot.id) ?? ' '),
        isEventCapture: slot.isEventCapture ? 1 : 0,
      }),
  )

  const totalNum = textObjects.length // = 8
  const result = await bridge.createStartUpPageContainer(
    new CreateStartUpPageContainer({
      containerTotalNum: totalNum,
      textObject: textObjects,
    }),
  )
  // result === 0 で success（SDK の StartUpPageCreateResult.Success）
  if (Number(result) !== 0) {
    throw new Error(`createStartUpPageContainer failed: result=${String(result)}`)
  }

  // 書き込みシリアライズ用の Promise チェーン（並列 write を避け、SDK 負荷を抑える）
  let rendering: Promise<unknown> = Promise.resolve()
  // 直近送信済みの content（container ID -> content）。dedup 用
  const lastSent = new Map<number, string>()
  // 初期化時に送った content を lastSent に記録
  for (const slot of TEXT_SLOTS) {
    const initial = initialTexts.get(slot.id)
    if (initial !== undefined) lastSent.set(slot.id, sanitize(initial))
  }

  const render = (map: RenderMap): Promise<void> => {
    const job = rendering.then(async () => {
      for (const slot of TEXT_SLOTS) {
        const requested = map.get(slot.id)
        if (requested === undefined) continue // 指定なし = 前回値維持
        // v0.5-6: emoji / 未対応文字を除去 + 空文字を半角スペース化（SDK の「変更なし」回避）
        const next = sanitize(requested)
        if (lastSent.get(slot.id) === next) continue // 同一なら再送しない
        try {
          const ok = await bridge.textContainerUpgrade(
            new TextContainerUpgrade({
              containerID: slot.id,
              containerName: slot.name,
              content: next,
            }),
          )
          // F7: SDK が false を返した場合は失敗として lastSent を更新しない（次回再送される）
          if (ok === false) {
            console.warn(`[g2-run-hud] textContainerUpgrade(${slot.name}) returned false`)
          } else {
            lastSent.set(slot.id, next)
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err)
          console.error(`[g2-run-hud] textContainerUpgrade(${slot.name}) failed:`, msg)
          // lastSent を更新しない → 次の tick で再送される
        }
      }
    })
    // チェーンは継続させる（次の render を堰き止めない）が、呼び出し側には reject を伝える
    rendering = job.catch(() => {
      /* swallow on chain side */
    })
    return job
  }

  const subscriptions = new Set<() => void>()
  const onEvent = (handler: (event: EvenHubEvent) => void): (() => void) => {
    const unsub = bridge.onEvenHubEvent(handler)
    subscriptions.add(unsub)
    return () => {
      try {
        unsub()
      } catch {
        /* noop */
      }
      subscriptions.delete(unsub)
    }
  }

  const shutdown = async (exitMode: ExitMode = 0): Promise<void> => {
    for (const unsub of subscriptions) {
      try {
        unsub()
      } catch {
        // 個別 unsub 失敗は無視
      }
    }
    subscriptions.clear()
    try {
      await bridge.shutDownPageContainer(exitMode)
    } catch {
      // shutdown 失敗は無視（既に閉じている等）
    }
  }

  return { render, onEvent, shutdown }
}
