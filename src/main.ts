// G2 Run HUD エントリーポイント
// - RunStore を作って 1 秒タイマーで tick（経過時間 + 現在時刻の両方を更新）
// - 実 GPS (navigator.geolocation.watchPosition) で距離計測
// - EvenAppBridge 経由で G2 の text container 群を更新
// - コンパニオン UI（index.html）の DOM を state 変化に追従させる
//
// v0.2.6 でテストモードを完全削除。dev 環境では EvenAppBridge 未検出のスタンドアロン
// モードで companion UI のメトリクス表示確認のみ可能（GPS は実機 Hub アップロード後）。

import { waitForBridge, type RenderMap } from './even/bridge'
import { routeEvent } from './even/input'
import { renderForState } from './even/render'
import { selectRenderer } from './even/select-renderer'
import type { RendererPort } from './even/renderer-port'
import { RunStore, type RunState } from './run/state'
import { startGeolocation, type GeolocationHandle } from './run/geolocation'
import { formatDistance, formatPace, formatTime } from './run/format'
import type { StoragePort } from './storage/ports'
import { createBrowserStorageAdapter } from './storage/browser-adapter'
import { createSdkStorageAdapter } from './storage/sdk-adapter'
import { appendHistory, clearHistory, loadHistory } from './storage/run-history'
import { createEmptyHistory, type RunHistory } from './storage/types'
import { runHistoryEntryToGpx, gpxFileName } from './export/gpx'

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
const elBtnStartPause = $('btn-start-pause') as HTMLButtonElement
const elBtnReset = $('btn-reset') as HTMLButtonElement
const elLapsContainer = $('laps-container')
const elLapsCount = $('laps-count')
const elModeSection = $('mode-section')
const elModeRun = $('mode-btn-run') as HTMLButtonElement
const elModeWalk = $('mode-btn-walk') as HTMLButtonElement
const elHistoryList = $('history-list')
const elBtnHistoryClear = $('btn-history-clear') as HTMLButtonElement
const elStatusStatus = $('status-status')
const elStatusScreen = $('status-screen')
const elStatusBridge = $('status-bridge')
const elStatusGeo = $('status-geo')
const elErrorNotice = $('error-notice')
const elActionHint = $('action-hint')

// ---- Storage（Hub 接続後に SDK adapter へ差し替え） ----
let storagePort: StoragePort = createBrowserStorageAdapter()
let cachedHistory: RunHistory = createEmptyHistory()

async function refreshHistory(): Promise<void> {
  cachedHistory = await loadHistory(storagePort)
  renderHistory()
}

// ---- 初期化（onHistorySave で reset 時に履歴保存） ----
const store = new RunStore({
  onHistorySave: (entry) => {
    // reset() からの同期 callback。非同期 append は fire-and-forget で実行
    void appendHistory(storagePort, entry).then((updated) => {
      cachedHistory = updated
      renderHistory()
    })
  },
})

// ---- 位置情報ハンドル（実 GPS のみ） ----
let geoHandle: GeolocationHandle | null = null
// 同期 onError 経由の再入を防ぐ sentinel（F8 と組み合わせの二重ガード）
let geoStarting = false

// 描画は RendererPort 抽象経由（v0.5-2）。v0.5 では text renderer のみ。
let renderer: RendererPort | null = null
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

// ---- G2 への描画（RendererPort 経由） ----
function renderToG2(state: RunState, now: Date): void {
  if (renderer === null) return
  renderer.render(state, now).catch((err: unknown) => {
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
  if (renderer !== null) {
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
    `[ペース]   ${get(16)}   |   [ステータス] ${get(17)}`,
  ].join('\n')
}

function renderLapsDom(state: RunState): void {
  elLapsCount.textContent = String(state.laps.length)
  if (state.laps.length === 0) {
    elLapsContainer.innerHTML =
      '<div class="laps-empty">1km を超えるとここに記録されます</div>'
    return
  }
  // 最新が上に来るように reverse。DOM 構築は createElement で XSS 安全
  elLapsContainer.innerHTML = ''
  for (const lap of [...state.laps].reverse()) {
    const lapPace = lap.lapTimeMs > 0 ? formatPace(lap.lapTimeMs / 1000) : "--'--\""
    const avgPace = formatPace(lap.averagePaceSecPerKm)
    const message = lap.message ?? ''

    const row = document.createElement('div')
    row.className = 'lap-row'

    const head = document.createElement('div')
    head.className = 'lap-row-head'
    const km = document.createElement('span')
    km.className = 'lap-km'
    km.textContent = `LAP ${lap.km}`
    const time = document.createElement('span')
    time.className = 'lap-time'
    time.textContent = lapPace
    head.appendChild(km)
    head.appendChild(time)

    const meta = document.createElement('div')
    meta.className = 'lap-row-meta'
    const avg = document.createElement('span')
    avg.className = 'lap-avg'
    avg.textContent = `AVG ${avgPace}/km`
    const msg = document.createElement('span')
    msg.className = 'lap-msg'
    msg.textContent = message
    meta.appendChild(avg)
    meta.appendChild(msg)

    row.appendChild(head)
    row.appendChild(meta)
    elLapsContainer.appendChild(row)
  }
}

/**
 * モード選択 (RUN / WALK) の表示制御。
 * - idle 中はトグル可能、それ以外は disabled + 表示縮小（active 側のみ表示）
 */
function renderMode(state: RunState): void {
  const locked = state.status !== 'idle'
  elModeSection.classList.toggle('is-locked', locked)
  elModeRun.classList.toggle('is-active', state.mode === 'run')
  elModeWalk.classList.toggle('is-active', state.mode === 'walk')
  elModeRun.setAttribute('aria-checked', String(state.mode === 'run'))
  elModeWalk.setAttribute('aria-checked', String(state.mode === 'walk'))
  elModeRun.disabled = locked
  elModeWalk.disabled = locked
}

/**
 * 過去の走行履歴 (cachedHistory) を日付別グループに分けて DOM に描画。
 * グループ: 今日 / 昨日 / 今週 / それ以前。空グループは出さない。
 */
function renderHistory(): void {
  elBtnHistoryClear.disabled = cachedHistory.entries.length === 0
  if (cachedHistory.entries.length === 0) {
    elHistoryList.innerHTML = '<div class="history-empty">まだ走行履歴はありません</div>'
    return
  }
  elHistoryList.innerHTML = ''
  const groups = groupEntriesByDate(cachedHistory.entries, Date.now())
  for (const group of groups) {
    if (group.entries.length === 0) continue
    const groupEl = document.createElement('div')
    groupEl.className = 'history-group'

    const head = document.createElement('div')
    head.className = 'history-group-head'
    head.textContent = group.label
    groupEl.appendChild(head)

    for (const entry of group.entries) {
      groupEl.appendChild(createHistoryEntryElement(entry))
    }
    elHistoryList.appendChild(groupEl)
  }
}

type HistoryGroupKey = 'today' | 'yesterday' | 'thisWeek' | 'older'
interface HistoryGroup {
  key: HistoryGroupKey
  label: string
  entries: typeof cachedHistory.entries
}

/**
 * 履歴を 4 つのグループに振り分ける（時系列順を保つ）。
 * - 今日: 同じ年月日
 * - 昨日: 前日
 * - 今週: 直近 7 日以内（昨日より前）
 * - それ以前: 7 日より前
 */
function groupEntriesByDate(
  entries: typeof cachedHistory.entries,
  nowMs: number,
): HistoryGroup[] {
  const today = startOfDay(nowMs)
  const yesterday = today - 86_400_000 // 24h
  const weekStart = today - 6 * 86_400_000 // 直近 7 日 (today を含む) の開始

  const today_: HistoryGroup = { key: 'today', label: '今日', entries: [] }
  const yest: HistoryGroup = { key: 'yesterday', label: '昨日', entries: [] }
  const week: HistoryGroup = { key: 'thisWeek', label: '今週', entries: [] }
  const older: HistoryGroup = { key: 'older', label: 'それ以前', entries: [] }

  for (const entry of entries) {
    const dayStart = startOfDay(entry.startedAt)
    if (dayStart === today) today_.entries.push(entry)
    else if (dayStart === yesterday) yest.entries.push(entry)
    else if (dayStart >= weekStart) week.entries.push(entry)
    else older.entries.push(entry)
  }
  return [today_, yest, week, older]
}

/** ms タイムスタンプを「その日の 00:00:00」の ms に丸める */
function startOfDay(ms: number): number {
  const d = new Date(ms)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/**
 * 1 件分の history entry を <details> 要素として生成する。
 * renderHistory から各グループ内で呼ばれる。
 */
function createHistoryEntryElement(entry: RunHistory['entries'][number]): HTMLDetailsElement {
  const details = document.createElement('details')
  details.className = 'history-entry'

  const summary = document.createElement('summary')
  summary.className = 'history-summary'

  const date = document.createElement('div')
  date.className = 'history-date'
  date.textContent = formatHistoryDate(entry.startedAt)
  summary.appendChild(date)

  const stats = document.createElement('div')
  stats.className = 'history-stats'

  const badge = document.createElement('span')
  badge.className = `mode-badge ${entry.mode === 'run' ? 'mode-badge-run' : 'mode-badge-walk'}`
  badge.textContent = entry.mode === 'run' ? 'RUN' : 'WALK'
  stats.appendChild(badge)

  const dist = document.createElement('span')
  dist.className = 'stat-dist'
  dist.textContent = `${formatDistance(entry.distanceM)} km`
  stats.appendChild(dist)

  const time = document.createElement('span')
  time.className = 'stat-time'
  time.textContent = formatTime(entry.elapsedMs)
  stats.appendChild(time)

  const pace = document.createElement('span')
  pace.className = 'stat-pace'
  pace.textContent = `${formatPace(entry.averagePaceSecPerKm)}/km`
  stats.appendChild(pace)

  summary.appendChild(stats)
  details.appendChild(summary)

  // 展開部: GPX 書き出しボタン（全エントリで利用可）+ LAP 詳細（あれば）
  const detail = document.createElement('div')
  detail.className = 'history-detail'

  const gpxBtn = document.createElement('button')
  gpxBtn.type = 'button'
  gpxBtn.className = 'btn-ghost gpx-export'
  gpxBtn.textContent = 'GPX で書き出し'
  gpxBtn.addEventListener('click', () => downloadGpx(entry))
  detail.appendChild(gpxBtn)

  if (entry.laps.length > 0) {
    const h4 = document.createElement('h4')
    h4.textContent = 'LAP 詳細'
    detail.appendChild(h4)

    const ol = document.createElement('ol')
    ol.className = 'history-laps'
    for (const lap of entry.laps) {
      const li = document.createElement('li')
      const lapKm = document.createElement('span')
      lapKm.textContent = `LAP ${lap.km}`
      const lapTime = document.createElement('span')
      lapTime.textContent = lap.lapTimeMs > 0 ? formatPace(lap.lapTimeMs / 1000) : "--'--\""
      const lapMsg = document.createElement('span')
      lapMsg.textContent = lap.message ?? ''
      li.appendChild(lapKm)
      li.appendChild(lapTime)
      li.appendChild(lapMsg)
      ol.appendChild(li)
    }
    detail.appendChild(ol)
  }

  details.appendChild(detail)
  return details
}

/**
 * 履歴 1 件を GPX に変換して端末にダウンロードする（旦那様がボタンを押した時のみ実行）。
 * Blob URL を生成して a 要素クリックで保存。外部送信はしない。
 */
function downloadGpx(entry: RunHistory['entries'][number]): void {
  try {
    const xml = runHistoryEntryToGpx(entry)
    const blob = new Blob([xml], { type: 'application/gpx+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = gpxFileName(entry)
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[g2-run-hud] GPX export failed:', msg)
  }
}

/**
 * 履歴エントリの日時を「5月26日 (火) 09:23」形式に整形
 */
function formatHistoryDate(ms: number): string {
  const d = new Date(ms)
  const weekdays = ['日', '月', '火', '水', '木', '金', '土']
  const wd = weekdays[d.getDay()] ?? ''
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${d.getMonth() + 1}月${d.getDate()}日 (${wd}) ${hh}:${mm}`
}

// ---- まとめて再描画（state 変化と 1 秒 tick から共通呼び出し） ----
function renderAll(state: RunState): void {
  const now = new Date()
  const map = renderForState(state, now)
  renderToDom(state, map)
  if (renderer !== null) {
    renderer.render(state, now).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('[g2-run-hud] render failed:', msg)
    })
  }
}

// ---- store 購読 → DOM + G2 + 位置情報ソース ----
storeUnsubscribe = store.subscribe((state) => {
  renderAll(state)
  renderMode(state)
  syncPositionSourceFor(state)
})

// ---- DOM イベント（cleanup で removeEventListener できるよう named handler） ----
const onStartPauseClick = (): void => {
  store.toggleStartPause()
}
const onResetClick = (): void => {
  store.reset()
}
const onModeRunClick = (): void => {
  store.setMode('run')
}
const onModeWalkClick = (): void => {
  store.setMode('walk')
}

// 履歴クリアは 2 段階確認（誤タップ防止）
// 1 回目: ボタンを is-confirming 状態に + 文言変更、3 秒後タイムアウトで戻す
// 2 回目（3 秒以内）: 確定して履歴を消去
let historyClearConfirmTimer: ReturnType<typeof setTimeout> | null = null
function resetHistoryClearButton(): void {
  elBtnHistoryClear.classList.remove('is-confirming')
  elBtnHistoryClear.textContent = 'クリア'
  if (historyClearConfirmTimer !== null) {
    clearTimeout(historyClearConfirmTimer)
    historyClearConfirmTimer = null
  }
}
const onHistoryClearClick = (): void => {
  if (elBtnHistoryClear.classList.contains('is-confirming')) {
    void clearHistory(storagePort).then(async () => {
      resetHistoryClearButton()
      await refreshHistory()
    })
    return
  }
  elBtnHistoryClear.classList.add('is-confirming')
  elBtnHistoryClear.textContent = 'もう一度タップで確定'
  historyClearConfirmTimer = setTimeout(() => {
    resetHistoryClearButton()
  }, 3000)
}

elBtnStartPause.addEventListener('click', onStartPauseClick)
elBtnReset.addEventListener('click', onResetClick)
elModeRun.addEventListener('click', onModeRunClick)
elModeWalk.addEventListener('click', onModeWalkClick)
elBtnHistoryClear.addEventListener('click', onHistoryClearClick)

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
    // RendererPort 選択（?renderer=image は v0.6 未実装のため text フォールバック）
    const selection = selectRenderer()
    await selection.renderer.init(bridge, store.getState())
    if (timedOut) {
      // 競争上ありえないパスだが、安全のため late init した renderer は即 shutdown
      await selection.renderer.shutdown(0)
      return
    }
    renderer = selection.renderer
    elStatusBridge.setAttribute('data-state', 'connected')
    elStatusBridge.textContent =
      selection.fallbackNote === null ? '接続済' : `接続済（${selection.fallbackNote}）`

    // Hub 接続後は SDK storage を優先（Hub 内 WebView でも永続化を担保）
    storagePort = createSdkStorageAdapter(bridge)
    void refreshHistory()

    g2Unsubscribe = renderer.onEvent((event) => {
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
    console.warn('[g2-run-hud] renderer init failed:', msg)
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
    elModeRun.removeEventListener('click', onModeRunClick)
    elModeWalk.removeEventListener('click', onModeWalkClick)
    elBtnHistoryClear.removeEventListener('click', onHistoryClearClick)
    document.removeEventListener('visibilitychange', onVisibilityChange)
  } catch {
    /* noop */
  }

  // 履歴クリア確認タイマー解放
  resetHistoryClearButton()

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
  if (renderer !== null) {
    try {
      await renderer.shutdown(0)
    } catch {
      /* noop */
    }
    renderer = null
  }
  store.dispose()
}

window.addEventListener('beforeunload', () => {
  // 同期的にできる範囲だけ片付ける（async 結果を待たない）
  void cleanup()
})

// 起動：bridge 接続 + 履歴初回ロード（並列）
void bootstrapBridge()
void refreshHistory()
