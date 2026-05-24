// navigator.geolocation.watchPosition ラッパー
// テストモード OFF 時のみ使用。Hub アップロード後の実機でのみ動作する想定。
//
// F8 修正:
//   同期的に onError が呼ばれる経路（navigator.geolocation 非対応など）が
//   呼び出し側の代入完了前に走ると、main.ts 側で再入処理が走る危険があった
//   （`geoHandle = startGeolocation(...)` の代入直後に store.emit 経由で
//   `syncPositionSourceFor` が再評価され、geoHandle が null のまま再度
//   startGeolocation が呼ばれる無限ループ）。
//   コールバック呼び出しを queueMicrotask に逃がして同期 callout を排除する。

import type { GeoPosition } from './state'

export interface GeolocationHandle {
  stop: () => void
  /**
   * 既存の watchPosition を停止して新しい watch を開始する。
   * - iOS WebView がバックグラウンド復帰後に watch を再起動する必要がある場面で使う
   * - stopped 済みなら何もせず（cleanup 後の誤再起動を防止）
   */
  restart: () => void
}

export interface GeolocationOptions {
  onPosition: (pos: GeoPosition) => void
  onError: (message: string) => void
}

/**
 * watchPosition を開始する。
 * - enableHighAccuracy: true（ランニング用途）
 * - maximumAge: 0（古いキャッシュ拒否）
 * - timeout: 30000（30 秒で 1 度タイムアウト報告）
 * - 開始失敗時（geolocation 非対応 / permission denied）は onError でメッセージ通知
 * - 全コールバックは microtask で実行（同期呼び出しによる再入防止）
 */
export function startGeolocation(options: GeolocationOptions): GeolocationHandle {
  const { onPosition, onError } = options
  let stopped = false
  let watchId: number | null = null

  // 同期呼び出しを必ず microtask に逃がすラッパー
  const emitError = (message: string): void => {
    queueMicrotask(() => {
      if (stopped) return
      onError(message)
    })
  }
  const emitPosition = (pos: GeoPosition): void => {
    queueMicrotask(() => {
      if (stopped) return
      onPosition(pos)
    })
  }

  if (typeof navigator === 'undefined' || !('geolocation' in navigator)) {
    emitError('このブラウザは位置情報に対応していません')
    return {
      stop: () => {
        stopped = true
      },
      restart: () => {
        /* 非対応環境では restart も noop */
      },
    }
  }

  const watch = (): void => {
    watchId = navigator.geolocation.watchPosition(
      (geoPosition) => {
        const coords = geoPosition.coords
        emitPosition({
          lat: coords.latitude,
          lng: coords.longitude,
          accuracy: coords.accuracy,
          timestamp: geoPosition.timestamp,
        })
      },
      (err) => {
        // 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        const code = err.code
        if (code === 1) {
          emitError('位置情報を許可してください')
        } else if (code === 2) {
          emitError('位置情報を取得できません')
        } else if (code === 3) {
          emitError('位置情報の取得がタイムアウトしました')
        } else {
          emitError(`位置情報エラー: ${err.message}`)
        }
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 30_000,
      },
    )
  }

  watch()

  return {
    stop: () => {
      stopped = true
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
    },
    restart: () => {
      // 既に stop 済みの場合は復活させない（cleanup 後の事故防止）
      if (stopped) return
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId)
        watchId = null
      }
      watch()
    },
  }
}
