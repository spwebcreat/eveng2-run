// G2 Run HUD Service Worker (v0.5-1)
// 目的: PWA offline / Hub 審査の offline test 通過。
// 戦略: network-first。オンライン時は常に最新を取得する（version bump 時に古い UI が残る事故を防ぐ）。
//   ネットワーク失敗（オフライン）時のみキャッシュにフォールバックする。
// 制約: 同一オリジンの GET のみ対象。POST 等・他オリジンは素通し。
//
// 注意: Hub WebView での Service Worker 挙動は実機 QA（locked-phone QA の L-6）で要確認。
//   登録は main.ts 側で try/catch しており、登録失敗時もアプリ動作には影響しない。

const CACHE = 'g2-run-hud-v0.5.0'

self.addEventListener('install', () => {
  // 古い SW の待機をスキップして即時有効化
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    (async () => {
      try {
        // network-first: まずネットワークから取得し、成功したらキャッシュを更新して返す
        const fresh = await fetch(req)
        try {
          const cache = await caches.open(CACHE)
          await cache.put(req, fresh.clone())
        } catch (_e) {
          // キャッシュ書き込み失敗は無視（取得自体は成功している）
        }
        return fresh
      } catch (err) {
        // オフライン: キャッシュにフォールバック
        const cached = await caches.match(req)
        if (cached) return cached
        // ナビゲーションは index.html にフォールバック
        if (req.mode === 'navigate') {
          const index = await caches.match('index.html')
          if (index) return index
        }
        throw err
      }
    })(),
  )
})
