// RunState 中心の状態管理
// - 1 秒ごと tick で elapsedMs を進める
// - position 更新で distanceM を加算（実 GPS / ダミー両対応）
// - GPS モードは start() 時 'gps-waiting' で開始し、最初の有効サンプルで 'running' へ
// - pause/resume では lastPosition をクリアし、resume 初回サンプルは baseline 扱いで距離加算しない
// - ラップ検知で screenMode を 'lap' に切替、LAP_DISPLAY_MS 後に 'running'/'paused' へ復帰
// - 副作用は subscribe / lapTimer 経由のみ（DOM や bridge には直接触れない）

import { averagePaceSecPerKm, currentPaceSecPerKm, haversineDistanceM } from './pace'
import { detectLap } from './lap'

export type Status = 'idle' | 'running' | 'paused'
export type ScreenMode = 'idle' | 'gps-waiting' | 'running' | 'paused' | 'lap' | 'error'

export interface GeoPosition {
  lat: number
  lng: number
  accuracy?: number
  timestamp: number
}

export interface Lap {
  km: number
  distanceM: number
  elapsedMs: number
  lapTimeMs: number
  averagePaceSecPerKm: number
  message?: string
}

export interface RunState {
  status: Status
  screenMode: ScreenMode
  startedAt: number | null
  pausedDurationMs: number
  lastPausedAt: number | null
  elapsedMs: number
  distanceM: number
  currentPaceSecPerKm: number | null
  averagePaceSecPerKm: number | null
  lastPosition: GeoPosition | null
  positions: ReadonlyArray<GeoPosition>
  currentLapKm: number
  laps: ReadonlyArray<Lap>
  heartRateBpm: number | null
  message: string | null
  isTestMode: boolean
  errorMessage: string | null
  /**
   * true なら現在の paused は自動 pause（ユーザー手動 pause と区別）。
   * 自動 pause からの自動 resume では距離 baseline を維持するための識別に使う。
   */
  isAutoPaused: boolean
  /**
   * 自動 pause 突入時に保存した位置。
   * onPosition がこの位置から AUTO_RESUME_THRESHOLD_M を超えたら自動 resume する。
   * 手動 pause / 通常 running 時は null。
   */
  autoPauseAnchor: GeoPosition | null
}

const LAP_DISPLAY_MS = 6000 // ラップ画面表示時間（5〜8 秒の中央値）
const ACCURACY_GATE_M = 30 // accuracy > 30m は無視（仕様書 §8）
const MAX_SANE_JUMP_M = 200 // 1 サンプル間の異常ジャンプ閾値（停止中の GPS ドリフト対策）

// 自動 pause / resume の閾値（Apple Watch のワークアウト相当）
const AUTO_PAUSE_WINDOW_MS = 30_000 // 直近 30 秒
const AUTO_PAUSE_THRESHOLD_M = 5 // 5m 未満なら停止と判定
const AUTO_RESUME_THRESHOLD_M = 5 // 5m 以上の移動で再開判定
// 自動 pause 直後にすぐ resume 判定が走るのを避けるため最小 pause 滞在時間を設ける
const AUTO_PAUSE_MIN_DURATION_MS = 5_000

type Listener = (state: Readonly<RunState>) => void

export class RunStore {
  private state: RunState
  private listeners = new Set<Listener>()
  private lapTimerId: ReturnType<typeof setTimeout> | null = null

  constructor(isTestMode: boolean) {
    this.state = createInitialState(isTestMode)
  }

  getState(): Readonly<RunState> {
    return this.state
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener)
    // 初期状態を即時通知
    listener(this.state)
    return () => {
      this.listeners.delete(listener)
    }
  }

  private emit(): void {
    for (const listener of this.listeners) {
      listener(this.state)
    }
  }

  // ---- actions ----

  setTestMode(isTestMode: boolean): void {
    if (this.state.isTestMode === isTestMode) return
    // 走行中はモード変更を拒否（事故防止）
    if (this.state.status === 'running') return
    this.state = { ...this.state, isTestMode }
    this.emit()
  }

  toggleStartPause(): void {
    if (this.state.status === 'idle') {
      this.start()
    } else if (this.state.status === 'running') {
      this.pause()
    } else if (this.state.status === 'paused') {
      this.resume()
    }
  }

  start(): void {
    if (this.state.status === 'running') return
    const now = Date.now()
    // テストモードは即 running、GPS モードは最初の有効サンプル受信まで gps-waiting
    const screenMode: ScreenMode = this.state.isTestMode ? 'running' : 'gps-waiting'
    this.state = {
      ...this.state,
      status: 'running',
      screenMode,
      startedAt: this.state.startedAt ?? now,
      lastPausedAt: null,
      errorMessage: null,
    }
    this.emit()
  }

  pause(): void {
    this.doPause({ isAuto: false })
  }

  resume(): void {
    this.doResume({ isAuto: false })
  }

  /**
   * 内部実装: pause（手動・自動共通）
   * - 手動 pause は isAutoPaused=false、自動 pause は true をマーク
   * - 自動 pause/resume の判定は別途 maybeAutoPauseOrResume() に集約
   */
  private doPause(options: { isAuto: boolean }): void {
    if (this.state.status !== 'running') return
    // pause 中の移動を「停止中」として扱うため lastPosition / positions をクリア
    // resume 後の初回サンプルは onPosition 内で baseline として保存（距離加算しない）
    // 自動 pause の場合は autoPauseAnchor に直前位置を保存（resume 検知の基準）
    const anchor = options.isAuto ? this.state.lastPosition : null
    this.state = {
      ...this.state,
      status: 'paused',
      screenMode: 'paused',
      lastPausedAt: Date.now(),
      lastPosition: null,
      positions: [],
      isAutoPaused: options.isAuto,
      autoPauseAnchor: anchor,
    }
    this.emit()
  }

  private doResume(options: { isAuto: boolean }): void {
    if (this.state.status !== 'paused') return
    void options
    const now = Date.now()
    const addedPause = this.state.lastPausedAt !== null ? now - this.state.lastPausedAt : 0
    // GPS モードは resume 時に再び gps-waiting（initial サンプル受信まで）
    // ただしテストモード / 自動 resume（既に GPS サンプルが来ている）の場合は running 直行
    const screenMode: ScreenMode =
      this.state.isTestMode || options.isAuto ? 'running' : 'gps-waiting'
    this.state = {
      ...this.state,
      status: 'running',
      screenMode,
      pausedDurationMs: this.state.pausedDurationMs + Math.max(0, addedPause),
      lastPausedAt: null,
      // pause 時に既にクリア済だが念のため再度 null 化
      lastPosition: null,
      isAutoPaused: false,
      autoPauseAnchor: null,
    }
    this.emit()
  }

  /**
   * running 中の自動 pause 判定（onPosition 後 / tick 末尾から呼ばれる）。
   * 直近 30 秒の総移動距離 < 5m なら自動 pause を発火する。
   * @returns 自動 pause を発火したら true
   */
  private maybeAutoPause(): boolean {
    if (this.state.status !== 'running') return false
    const now = Date.now()
    const samples = this.state.positions.filter((p) => now - p.timestamp <= AUTO_PAUSE_WINDOW_MS)
    // window が初動 30 秒未満の場合は判定しない（誤検知防止）
    if (samples.length < 2) return false
    const oldest = samples[0]
    const newest = samples[samples.length - 1]
    if (!oldest || !newest) return false
    if (newest.timestamp - oldest.timestamp < AUTO_PAUSE_WINDOW_MS - 1000) return false
    let movedM = 0
    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1]
      const cur = samples[i]
      if (!prev || !cur) continue
      const d = haversineDistanceM(prev, cur)
      if (d <= MAX_SANE_JUMP_M) movedM += d
    }
    if (movedM < AUTO_PAUSE_THRESHOLD_M) {
      this.doPause({ isAuto: true })
      return true
    }
    return false
  }

  /**
   * 自動 pause 中の位置入力を受け、自動 resume すべきか判定する。
   * - 最小 pause 滞在時間（5 秒）を満たしていなければ判定しない
   * - autoPauseAnchor から AUTO_RESUME_THRESHOLD_M 以上離れていたら resume
   * @returns 自動 resume を発火したら true
   */
  private maybeAutoResume(pos: GeoPosition): boolean {
    if (this.state.status !== 'paused' || !this.state.isAutoPaused) return false
    if (this.state.autoPauseAnchor === null) return false
    const pausedAt = this.state.lastPausedAt
    const now = Date.now()
    if (pausedAt !== null && now - pausedAt < AUTO_PAUSE_MIN_DURATION_MS) return false
    const d = haversineDistanceM(this.state.autoPauseAnchor, pos)
    if (d < AUTO_RESUME_THRESHOLD_M) return false
    if (d > MAX_SANE_JUMP_M) return false // 異常ジャンプは無視
    this.doResume({ isAuto: true })
    return true
  }

  /**
   * 自動 pause 中も position の流入を許可するかを呼び出し側から判別するためのヘルパー
   * （main.ts の syncPositionSourceFor がこれを参照する）
   */
  shouldKeepPositionSourceActive(): boolean {
    return this.state.status === 'running' || this.state.isAutoPaused
  }

  reset(): void {
    // 走行中の reset は受け付けない（idle / paused のみ）
    if (this.state.status === 'running') return
    if (this.lapTimerId !== null) {
      clearTimeout(this.lapTimerId)
      this.lapTimerId = null
    }
    this.state = createInitialState(this.state.isTestMode)
    this.emit()
  }

  /**
   * 1 秒タイマーから呼ばれる tick。
   * - running 時のみ elapsedMs を加算
   * - screenMode 遷移はここでは行わない（onPosition / fireLap 側に集約）
   */
  tick(deltaMs: number): void {
    if (this.state.status !== 'running') return
    const newElapsed = this.state.elapsedMs + deltaMs
    const avgPace = averagePaceSecPerKm(this.state.distanceM, newElapsed)
    const curPace = currentPaceSecPerKm(this.state.positions) ?? avgPace
    this.state = {
      ...this.state,
      elapsedMs: newElapsed,
      averagePaceSecPerKm: avgPace,
      currentPaceSecPerKm: curPace,
    }

    // tick の流れで自動 pause 判定（GPS 更新が無くても 30 秒ごとに判定したい）
    if (this.maybeAutoPause()) return // doPause 内で emit 済み

    // tick の流れで lap 検知
    const lap = detectLap(this.state)
    if (lap !== null) {
      this.fireLap(lap)
      return // emit は fireLap 内で済む
    }
    this.emit()
  }

  /**
   * 位置情報受信時の処理（実 GPS / ダミー共通）
   * - running 時のみ受け付ける（paused / idle は破棄）
   * - 精度フィルタ（accuracy > 30m は無視）/ 異常ジャンプフィルタ（>200m）
   * - lastPosition===null（start / resume 直後）の場合は baseline として保存のみ（距離加算なし）
   * - lap 検知でラップ画面遷移を含む
   * - GPS モードの初回有効サンプルで screenMode 'gps-waiting' / 'error' → 'running'
   */
  onPosition(pos: GeoPosition): void {
    // 自動 pause 中: resume 判定のみ行う（距離加算はしない）
    if (this.state.status === 'paused' && this.state.isAutoPaused) {
      if (pos.accuracy !== undefined && pos.accuracy > ACCURACY_GATE_M) return
      this.maybeAutoResume(pos)
      return
    }
    if (this.state.status !== 'running') return
    // 精度フィルタ（ダミーは accuracy=0 で通す・実 GPS で 30m 超は捨てる）
    if (pos.accuracy !== undefined && pos.accuracy > ACCURACY_GATE_M) {
      // gps-waiting のまま維持（screenMode 遷移しない）
      return
    }

    const prev = this.state.lastPosition
    let added = 0
    if (prev !== null) {
      const d = haversineDistanceM(prev, pos)
      // 異常ジャンプは捨てる（停止中の GPS ドリフト・キャリブレ直後）
      if (d <= MAX_SANE_JUMP_M) {
        added = d
      }
    }
    // prev === null（start / resume 直後）の場合は baseline 扱い・距離加算なし

    const newDistance = this.state.distanceM + added
    // 直近 60 サンプル保持（currentPace 計算窓を超える分は捨てる）
    const newPositions: GeoPosition[] = [...this.state.positions, pos].slice(-60)

    // GPS モードで gps-waiting / error の場合は running へ遷移
    const wasWaitingOrError =
      this.state.screenMode === 'gps-waiting' || this.state.screenMode === 'error'
    const newScreenMode: ScreenMode = wasWaitingOrError ? 'running' : this.state.screenMode

    this.state = {
      ...this.state,
      lastPosition: pos,
      positions: newPositions,
      distanceM: newDistance,
      screenMode: newScreenMode,
      errorMessage: wasWaitingOrError ? null : this.state.errorMessage,
    }

    // 自動 pause 判定（新サンプル追加直後の窓で判定）
    if (this.maybeAutoPause()) return

    // 距離が更新された後にラップ検知
    const lap = detectLap(this.state)
    if (lap !== null) {
      this.fireLap(lap)
      return
    }
    this.emit()
  }

  /**
   * GPS 取得エラー（permission denied / unavailable / timeout）
   * - running 中のみ screenMode を 'error' に遷移
   * - idle / paused 中は errorMessage だけ保持（screenMode は変えない）
   */
  onGeolocationError(message: string): void {
    const newScreenMode: ScreenMode =
      this.state.status === 'running' ? 'error' : this.state.screenMode
    this.state = {
      ...this.state,
      screenMode: newScreenMode,
      errorMessage: message,
    }
    this.emit()
  }

  /**
   * Lap 検知後の状態遷移
   * 1. laps 配列に追加
   * 2. screenMode 'lap' + message 表示
   * 3. LAP_DISPLAY_MS 後に 'running' / 'paused' へ復帰
   */
  private fireLap(lap: Lap): void {
    if (this.lapTimerId !== null) {
      clearTimeout(this.lapTimerId)
      this.lapTimerId = null
    }
    this.state = {
      ...this.state,
      currentLapKm: lap.km,
      laps: [...this.state.laps, lap],
      screenMode: 'lap',
      message: lap.message ?? null,
    }
    this.emit()

    this.lapTimerId = setTimeout(() => {
      this.lapTimerId = null
      // 走行中であれば running、pause された場合は paused に戻す
      const screenMode: ScreenMode = this.state.status === 'paused' ? 'paused' : 'running'
      this.state = {
        ...this.state,
        screenMode,
        message: null,
      }
      this.emit()
    }, LAP_DISPLAY_MS)
  }

  /**
   * 終了処理（unsubscribe / タイマー解放）
   */
  dispose(): void {
    if (this.lapTimerId !== null) {
      clearTimeout(this.lapTimerId)
      this.lapTimerId = null
    }
    this.listeners.clear()
  }
}

function createInitialState(isTestMode: boolean): RunState {
  return {
    status: 'idle',
    screenMode: 'idle',
    startedAt: null,
    pausedDurationMs: 0,
    lastPausedAt: null,
    elapsedMs: 0,
    distanceM: 0,
    currentPaceSecPerKm: null,
    averagePaceSecPerKm: null,
    lastPosition: null,
    positions: [],
    currentLapKm: 0,
    laps: [],
    heartRateBpm: null,
    message: null,
    isTestMode,
    errorMessage: null,
    isAutoPaused: false,
    autoPauseAnchor: null,
  }
}
