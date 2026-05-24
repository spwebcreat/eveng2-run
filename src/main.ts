// G2 Run HUD エントリーポイント
// - RunStore を作って 1 秒タイマーで tick（経過時間 + 現在時刻の両方を更新）
// - 実 GPS (navigator.geolocation.watchPosition) で距離計測
// - EvenAppBridge 経由で G2 の text container 群を更新
// - コンパニオン UI（index.html）の DOM を state 変化に追従させる
//
// v0.2.6 でテストモードを完全削除。dev 環境では EvenAppBridge 未検出のスタンドアロン
// モードで companion UI のメトリクス表示確認のみ可能（GPS は実機 Hub アップロード後）。

import {
  attachG2Hud,
  waitForBridge,
  type G2HudHandle,
  type RenderMap,
} from './even/bridge'
import { routeEvent } from './even/input'
import { renderForState } from './even/render'
import { RunStore, type RunState } from './run/state'
import { startGeolocation, type GeolocationHandle } from './run/geolocation'
import { formatDistance, formatPace, formatTime, formatHeartRate } from './run/format'

// ---- DOM 取得（必須要素は型ガード） ----
function $(id: string): HTMLElement {
  const el = document.getElementById(id)
  if (!el) throw new Error(`Element not found: #${id}`)
  return el
}

const elHudPreview = $('hud-preview')
const elMetricDistance = $('metric-distance')
const elMetricAvgPace = $('metric-avg-pace')
const elMetricTime = $('metric-time')
const elMetricHr = $('metric-hr')
const elBtnStartPause = $('btn-start-pause') as HTMLButtonElement
const elBtnReset = $('btn-reset') as HTMLButtonElement
const elBtnLapsClear = $('btn-laps-clear') as HTMLButtonElement
const elLapsContainer = $('laps-container')
const elStatusStatus = $('status-status')
const elStatusScreen = $('status-screen')
const elStatusBridge = $('status-bridge')
const elStatusGeo = $('status-geo')
const elErrorNotice = $('error-notice')
const elActionHint = $('action-hint')

// ---- 初期化 ----
const store = new RunStore()

// ---- 位置情報ハンドル（実 GPS のみ） ----
let geoHandle: GeolocationHandle | null = null
// 同期 onError 経由の再入を防ぐ sentinel（F8 と組み合わせの二重ガード）
let geoStarting = false

let g2Handle: G2HudHandle | null = null
let g2Unsubscribe: (() => void) | null = null

// store.subscribe の unsubscribe（W4 cleanup 対応）
let storeUnsubscribe: (() => void) | null = null

// ---- 1 秒タイマー ----
// 経過時間は Date 差分で計算するため、setInterval が背景化で抑制されても
// 復帰時に正しい elapsedMs が反映される（凍結中の差分も加算される）。
const TICK_MS = 1000
let lastTickAt = Date.now()
const tickTimer = setInterval(() => {
  const now = Date.now()
  const delta = now - lastTickAt
  lastTickAt = now
  store.tick(delta)
  // store 変化が無くても現在時刻は毎秒更新したいので、明示的に再描画
  renderAll(store.getState())
}, TICK_MS)

// ---- Wake Lock（画面 OFF 抑制）----
// Screen Wake Lock API（iOS Safari 16.4+ / Android Chrome）で
// バックグラウンド遷移そのものを減らす（完全防止はできないが効果あり）。
type WakeLockSentinelLike = { release: () => Promise<void> }
let wakeLock: WakeLockSentinelLike | null = null
async function requestWakeLock(): Promise<void> {
  try {
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> }
    }
    if (!nav.wakeLock) return
    wakeLock = await nav.wakeLock.request('screen')
  } catch (err: unknown) {
    // ユーザーがフォーカスしていない状態などで失敗するが、その場合は無視
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[g2-run-hud] wake lock request failed:', msg)
  }
}
async function releaseWakeLock(): Promise<void> {
  if (wakeLock === null) return
  try {
    await wakeLock.release()
  } catch {
    /* noop */
  }
  wakeLock = null
}

// ---- visibilitychange による GPS 復帰対策 ----
// iOS WebView は背景化で JS 実行が ~5 秒で凍結され watchPosition callback も停止する。
// 復帰検知時に：
//   1. 実 GPS モードで running 中なら watch を再起動（古い watch は応答が来ない可能性）
//   2. Wake Lock を再取得（visibilitychange で自動解放される）
//   3. 経過時間は Date 差分計算なので別途リセット不要（tick が次回呼ばれた時に補正される）
const onVisibilityChange = (): void => {
  if (document.visibilityState === 'visible') {
    // 復帰: 再描画 + GPS 再起動 + Wake Lock 再取得
    renderAll(store.getState())
    const state = store.getState()
    const isActive = state.status === 'running' || state.isAutoPaused
    if (isActive && geoHandle !== null) {
      geoHandle.restart()
      elStatusGeo.textContent = 'GPS 再起動（復帰）'
    }
    // 計測中（running / 自動 pause）だけ Wake Lock を再取得（idle 中は不要）
    if (isActive) {
      void requestWakeLock()
    }
  } else {
    // 背景化: Wake Lock は OS が自動解放する。明示的な release はしない（OS 任せ）
  }
}
document.addEventListener('visibilitychange', onVisibilityChange)

// ---- 位置情報の起動制御（status 遷移に応じて） ----
function syncPositionSourceFor(state: RunState): void {
  // running 状態に入ったら Wake Lock を要求、running 以外に出たら解放
  // 自動 pause 中も Wake Lock は維持（ユーザーはまだ運動中の意識）
  const keepActive = state.status === 'running' || state.isAutoPaused
  if (keepActive && wakeLock === null) {
    void requestWakeLock()
  } else if (!keepActive && wakeLock !== null) {
    void releaseWakeLock()
  }

  // 自動 pause 中は位置情報ソースを維持して自動 resume を検知する
  if (keepActive) {
    if (geoHandle === null && !geoStarting) {
      // sentinel を先に立てて再入防止（F8 二重ガード）
      geoStarting = true
      try {
        geoHandle = startGeolocation({
          onPosition: (pos) => {
            store.onPosition(pos)
            elStatusGeo.textContent = `GPS 取得中（accuracy ${Math.round(pos.accuracy ?? 0)}m）`
          },
          onError: (msg) => {
            elStatusGeo.textContent = `GPS エラー: ${msg}`
            store.onGeolocationError(msg)
          },
        })
        elStatusGeo.textContent = 'GPS 取得待ち…'
      } finally {
        geoStarting = false
      }
    }
  } else {
    // running でも自動 pause でもない（idle / 手動 paused）は位置情報を停止
    if (geoHandle !== null) {
      geoHandle.stop()
      geoHandle = null
      elStatusGeo.textContent = '停止'
    }
  }
}

// ---- G2 への描画（multi-container RenderMap） ----
function renderToG2(state: RunState, now: Date): void {
  if (g2Handle === null) return
  const map = renderForState(state, now)
  g2Handle.render(map).catch((err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[g2-run-hud] render failed:', msg)
    // 失敗時は bridge 側で lastSent を更新しないので次の tick で自動再送される
  })
}

// ---- DOM 更新 ----
function renderToDom(state: RunState, renderMap: RenderMap): void {
  // HUD プレビュー: container 別 content を順に表示（G2 実機を模した擬似レイアウト）
  elHudPreview.textContent = formatHudPreview(renderMap)

  // メトリクス
  elMetricDistance.textContent = `${formatDistance(state.distanceM)} km`
  elMetricAvgPace.textContent = `${formatPace(state.averagePaceSecPerKm)}/km`
  elMetricTime.textContent = formatTime(state.elapsedMs)
  elMetricHr.textContent = formatHeartRate(state.heartRateBpm).replace(/^HR\s*/, '')

  // ボタン状態
  if (state.status === 'idle') {
    elBtnStartPause.textContent = 'スタート'
    elBtnStartPause.classList.add('primary')
    elBtnStartPause.classList.remove('warning')
    elBtnStartPause.disabled = false
  } else if (state.status === 'running') {
    elBtnStartPause.textContent = '一時停止'
    elBtnStartPause.classList.remove('primary')
    elBtnStartPause.classList.add('warning')
    elBtnStartPause.disabled = false
  } else if (state.status === 'paused') {
    elBtnStartPause.textContent = '再開'
    elBtnStartPause.classList.add('primary')
    elBtnStartPause.classList.remove('warning')
    elBtnStartPause.disabled = false
  }

  // Reset は running 中以外で有効
  elBtnReset.disabled = state.status === 'running'
  elBtnLapsClear.disabled = state.laps.length === 0 || state.status === 'running'

  // ステータス表示
  elStatusStatus.textContent = state.status
  elStatusScreen.textContent = state.screenMode

  // エラー表示
  if (state.errorMessage !== null && state.errorMessage.length > 0) {
    elErrorNotice.style.display = 'block'
    elErrorNotice.textContent = state.errorMessage
  } else {
    elErrorNotice.style.display = 'none'
    elErrorNotice.textContent = ''
  }

  // アクションヒント（ブリッジ接続後のみ表示）
  if (g2Handle !== null) {
    elActionHint.style.display = 'block'
  }

  // ラップ履歴
  renderLapsDom(state)
}

/**
 * HUD プレビュー文字列を組み立てる。
 * G2 の実機レイアウト（3x3 グリッド: 上3 / 中メッセージ / 下3）を擬似的に表現する。
 */
function formatHudPreview(map: RenderMap): string {
  // container ID は bridge.ts CONTAINER_IDS と一致
  const get = (id: number): string => (map.get(id) ?? '').replace(/\n/g, ' / ')
  return [
    `[経過]   ${get(11)}   |   [距離]    ${get(12)}   |   [日時]     ${get(13)}`,
    `[メッセージ]   ${get(14)}`,
    `[心拍]   ${get(15)}   |   [ペース]   ${get(16)}   |   [ステータス] ${get(17)}`,
  ].join('\n')
}

function renderLapsDom(state: RunState): void {
  if (state.laps.length === 0) {
    elLapsContainer.innerHTML =
      '<div class="laps-empty">1km を超えるとラップが記録されます。</div>'
    return
  }
  // 最新が上に来るように reverse
  const rows = [...state.laps].reverse().map((lap) => {
    const lapPace = lap.lapTimeMs > 0 ? formatPace(lap.lapTimeMs / 1000) : "--'--\""
    const avgPace = formatPace(lap.averagePaceSecPerKm)
    const message = lap.message ?? ''
    const row = document.createElement('div')
    row.className = 'lap-row'

    const label = document.createElement('span')
    label.className = 'label'
    label.textContent = `LAP ${lap.km}  ${lapPace} / AVG ${avgPace}`

    const msg = document.createElement('span')
    msg.className = 'message'
    msg.textContent = message

    row.appendChild(label)
    row.appendChild(msg)
    return row
  })

  elLapsContainer.innerHTML = ''
  for (const row of rows) {
    elLapsContainer.appendChild(row)
  }
}

// ---- まとめて再描画（state 変化と 1 秒 tick から共通呼び出し） ----
function renderAll(state: RunState): void {
  const now = new Date()
  const map = renderForState(state, now)
  renderToDom(state, map)
  if (g2Handle !== null) {
    g2Handle.render(map).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[g2-run-hud] render failed:', msg)
    })
  }
}

// ---- store 購読 → DOM + G2 + 位置情報ソース ----
storeUnsubscribe = store.subscribe((state) => {
  renderAll(state)
  syncPositionSourceFor(state)
})

// ---- DOM イベント（cleanup で removeEventListener できるよう named handler） ----
const onStartPauseClick = (): void => {
  store.toggleStartPause()
}
const onResetClick = (): void => {
  store.reset()
}
const onLapsClearClick = (): void => {
  // laps クリアは reset 経由（純粋な laps だけ消す API は提供せず簡素化）
  store.reset()
}
elBtnStartPause.addEventListener('click', onStartPauseClick)
elBtnReset.addEventListener('click', onResetClick)
elBtnLapsClear.addEventListener('click', onLapsClearClick)

// ---- EvenAppBridge 起動（F2 2 段分離） ----
const BRIDGE_TIMEOUT_MS = 5000

async function bootstrapBridge(): Promise<void> {
  elStatusBridge.setAttribute('data-state', 'waiting')
  elStatusBridge.textContent = '接続待ち（EvenAppBridge）'

  // Step 1: bridge 取得を timeout 競争する（副作用なし）
  let timedOut = false
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null

  const bridgePromise = waitForBridge()
  const timeoutPromise = new Promise<'timeout'>((resolve) => {
    timeoutHandle = setTimeout(() => {
      timedOut = true
      resolve('timeout')
    }, BRIDGE_TIMEOUT_MS)
  })

  const raceResult = await Promise.race([bridgePromise, timeoutPromise])

  if (raceResult === 'timeout') {
    // timeout 勝利: container 作成は行わない
    elStatusBridge.setAttribute('data-state', 'unavailable')
    elStatusBridge.textContent =
      'スタンドアロン（EvenAppBridge 未検出・コンパニオン UI のみ動作）'

    // 念のため: 後追いで bridge が解決しても container 作成は一切走らせない
    bridgePromise.catch(() => {
      /* ignore late rejection */
    })
    return
  }

  // 正常解決: timeout を解除して container 作成 (Step 2) へ
  if (timeoutHandle !== null) {
    clearTimeout(timeoutHandle)
    timeoutHandle = null
  }

  const bridge = raceResult
  try {
    const initialMap = renderForState(store.getState(), new Date())
    const handle = await attachG2Hud(bridge, initialMap)
    if (timedOut) {
      // 競争上ありえないパスだが、安全のため late attach した handle は即 shutdown
      await handle.shutdown(0)
      return
    }
    g2Handle = handle
    elStatusBridge.setAttribute('data-state', 'connected')
    elStatusBridge.textContent = '接続済'

    g2Unsubscribe = g2Handle.onEvent((event) => {
      routeEvent(event, {
        store,
        onSystemExit: () => {
          void cleanup()
        },
      })
    })

    // 初回 render（store subscribe 経由でも届くが、G2 への即時反映を担保）
    renderToG2(store.getState(), new Date())
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[g2-run-hud] attachG2Hud failed:', msg)
    elStatusBridge.setAttribute('data-state', 'error')
    elStatusBridge.textContent = `G2 接続エラー: ${msg}`
  }
}

// ---- クリーンアップ（idempotent） ----
let cleanedUp = false
async function cleanup(): Promise<void> {
  if (cleanedUp) return
  cleanedUp = true

  // DOM event listener 解除
  try {
    elBtnStartPause.removeEventListener('click', onStartPauseClick)
    elBtnReset.removeEventListener('click', onResetClick)
    elBtnLapsClear.removeEventListener('click', onLapsClearClick)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  } catch {
    /* noop */
  }

  // Wake Lock 解放
  void releaseWakeLock()

  // store 購読解除
  try {
    storeUnsubscribe?.()
  } catch {
    /* noop */
  }
  storeUnsubscribe = null

  // G2 イベント購読解除
  try {
    g2Unsubscribe?.()
  } catch {
    /* noop */
  }
  g2Unsubscribe = null

  // 位置情報停止
  if (geoHandle !== null) {
    geoHandle.stop()
    geoHandle = null
  }
  clearInterval(tickTimer)

  // G2 shutdown（自動 cleanup = exitMode 0）
  if (g2Handle !== null) {
    try {
      await g2Handle.shutdown(0)
    } catch {
      /* noop */
    }
    g2Handle = null
  }
  store.dispose()
}

window.addEventListener('beforeunload', () => {
  // 同期的にできる範囲だけ片付ける（async 結果を待たない）
  void cleanup()
})

// 起動
void bootstrapBridge()
