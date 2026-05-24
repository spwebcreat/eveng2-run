# Codex 引き継ぎファイル：Even G2 Running HUD MVP

作成日: 2026-05-23  
対象: Even Realities G2 / Even Hub Plugin  
目的: ランニング中に Apple Watch で見ているような基本データを、Even G2 に HUD 表示するプロトタイプを作る。  
方針: 心拍数は後回し。まずは iPhone の位置情報ベースで「距離・ペース・経過時間」を表示する。

---

## 1. 背景

ユーザーは Even Realities G2 を日常的に活用したい。  
ほぼ毎日ランニングしており、ランニング中に以下の情報を G2 に表示したい。

- 距離
- ペース
- 経過時間
- 心拍数
- 将来的にマップ / ナビ表示
- 1kmごとのラップ表示
- ランダムメッセージ表示

ただし、現時点では Even Hub プラグインはスマホアプリ側から起動する必要がありそうで、G2単体常駐アプリというより「スマホ側WebViewで動作し、Bluetooth経由でG2へ表示する」前提で考える。

---

## 2. 重要な前提

### Even Hub 側

Even Hub アプリはスマホ側の WebView で実行され、`EvenAppBridge` 経由で G2 へ表示指示を送る構造。

想定フロー:

```txt
Even Hub Plugin WebView
  ↓ EvenAppBridge
Even Realities App
  ↓ Bluetooth
Even G2
```

参考:

- https://hub.evenrealities.com/docs/getting-started/architecture
- https://github.com/even-realities/evenhub-templates
- https://zenn.dev/bigdra/articles/eveng2-sdk-features

### Apple Watch 側

将来的に心拍数をリアルタイム取得するなら、watchOS アプリ開発が必要になる可能性が高い。  
ただし MVP では心拍数は扱わない。

MVP では以下の方針:

- Apple Watch 連携なし
- HealthKit 連携なし
- WatchConnectivity なし
- iPhone の GPS / Geolocation 相当で距離・ペース・経過時間を計測
- 心拍数は `-- bpm` またはダミー表示

---

## 3. MVP のゴール

### MVP名

`G2 Run HUD`

### MVPで実装するもの

1. Even Hub プラグインとして起動できる
2. G2 にランニングHUD画面を表示する
3. Start / Pause / Reset ができる
4. iPhone側の位置情報を使って距離を計測する
5. 距離から現在ペースまたは平均ペースを算出する
6. 経過時間を表示する
7. 1kmごとにラップ画面を一時表示する
8. 一定間隔またはラップ時にランダムメッセージを表示する
9. 心拍数欄は後回しとして `HR -- bpm` 表示にする

---

## 4. MVPでやらないこと

以下は初期実装では対象外。

- Apple Watch 心拍数取得
- HealthKit 連携
- WatchConnectivity
- Apple純正ワークアウトアプリとの同期
- Strava / Nike Run Club / Garmin 連携
- バックグラウンド常時計測
- 高精細マップ表示
- ルートナビ
- サーバー連携
- アカウント認証
- データ永続化の高度な実装

---

## 5. 表示UI案

### 通常HUD

G2表示領域は小さく、ランニング中に一瞬で読める必要がある。  
テキストは最小限にする。

```txt
RUN

3.24 km
5'42"/km
18:31
HR -- bpm
```

### 1kmラップ表示

1km到達時に 5〜8秒だけ表示し、その後通常HUDに戻る。

```txt
LAP 3

1km 5'39"
AVG 5'44"
Nice pace!
```

### 一時メッセージ表示

```txt
肩の力を抜こう
次の1kmだけ集中
いいリズム！
呼吸を整える
ナイスラン！
```

---

## 6. 操作仕様

Even G2側の入力イベントは SDK の `onEvenHubEvent` などで取得できる想定。  
イベント名・入力種別は実機/SDKバージョンに合わせて確認すること。

想定操作:

| 操作 | 内容 |
|---|---|
| Tap | Start / Pause |
| Double Tap | Reset |
| Long Press | Lap / Message の手動表示、または終了 |
| R1 Ring | 将来的に画面切り替え |

MVPでは最低限 `Start / Pause / Reset` ができればよい。

---

## 7. データ項目

```ts
interface RunState {
  status: 'idle' | 'running' | 'paused' | 'finished'
  startedAt: number | null
  pausedDurationMs: number
  lastPausedAt: number | null

  elapsedMs: number

  distanceM: number
  currentPaceSecPerKm: number | null
  averagePaceSecPerKm: number | null

  lastPosition: GeoPosition | null
  positions: GeoPosition[]

  currentLapKm: number
  laps: Lap[]

  heartRateBpm: number | null
  message: string | null
}

interface GeoPosition {
  lat: number
  lng: number
  accuracy?: number
  timestamp: number
}

interface Lap {
  km: number
  distanceM: number
  elapsedMs: number
  lapTimeMs: number
  averagePaceSecPerKm: number
  message?: string
}
```

---

## 8. 距離計算

位置情報2点間の距離は Haversine formula で算出する。  
GPS誤差を考慮し、精度が悪い点は捨てる。

推奨ルール:

- `accuracy > 30m` の位置情報は無視
- 前回位置からの移動距離が極端に大きい場合は無視
- 停止中は距離加算しない
- 位置更新頻度は 1〜3秒程度を想定
- MVPでは厳密なフィルタリングより動作確認を優先

---

## 9. ペース計算

### 平均ペース

```txt
averagePaceSecPerKm = elapsedSec / (distanceM / 1000)
```

### 現在ペース

MVPでは平均ペースのみでもよい。  
現在ペースを出す場合は直近 N 秒、または直近 100〜300m の移動から算出する。

最初のMVPでは表示名を `PACE` とし、平均ペースを出すだけでも可。

---

## 10. ラップ仕様

1kmごとにラップを自動生成。

条件:

```txt
Math.floor(distanceM / 1000) > currentLapKm
```

処理:

1. ラップ番号を更新
2. 前回ラップからの経過時間を計算
3. `laps` に保存
4. ランダムメッセージを1つ選ぶ
5. G2にラップ画面を表示
6. 5〜8秒後に通常HUDへ戻る

---

## 11. ランダムメッセージ候補

MVPでは固定配列からランダムに選ぶ。

```ts
const RUN_MESSAGES = [
  'いいリズム！',
  '肩の力を抜こう',
  '次の1kmだけ集中',
  '呼吸を整える',
  'ナイスラン！',
  'フォーム意識',
  '無理せず淡々と',
  'このペースでOK',
  '腕振りを軽く',
  'あと少し集中',
]
```

---

## 12. 推奨ディレクトリ構成

Even Hub 公式テンプレートをベースにする。

```txt
g2-run-hud/
  package.json
  app.json
  index.html
  src/
    main.ts
    even/
      bridge.ts
      render.ts
      input.ts
    run/
      state.ts
      geolocation.ts
      pace.ts
      lap.ts
      messages.ts
      format.ts
    styles/
      app.css
  docs/
    HANDOFF.md
```

---

## 13. 実装タスク

### Task 1: Even Hub テンプレート作成

- 公式テンプレートを使って最小アプリを作る
- G2に `Hello RUN HUD` を表示
- スマホ側WebViewでも状態確認できるUIを用意

参考:

- https://github.com/even-realities/evenhub-templates

### Task 2: HUD描画

- `renderRunHud(state)` を作る
- G2に以下を表示

```txt
RUN

0.00 km
--'--"/km
00:00
HR -- bpm
```

### Task 3: タイマー処理

- Start
- Pause
- Reset
- 経過時間表示
- `setInterval` は 1秒更新でよい

### Task 4: 位置情報取得

- `navigator.geolocation.watchPosition` を使う
- 位置情報許可が必要
- GPSが取れない場合はエラー表示

```txt
GPS WAITING
位置情報を許可してください
```

### Task 5: 距離計算

- Haversine formula
- 精度の悪いGPS点を除外
- `distanceM` に加算

### Task 6: ペース計算

- 平均ペースを計算
- `5'42"/km` のように整形

### Task 7: ラップ検知

- 1kmごとにラップ追加
- 5〜8秒だけラップ画面表示

### Task 8: ランダムメッセージ

- 1kmラップ時に表示
- 将来的には任意間隔表示も可能

### Task 9: 実機テスト

- 室内ではダミーデータモード
- 屋外では実GPSモード
- 実際にランニング中に見やすい文字サイズ・更新頻度を確認

---

## 14. ダミーデータモード

開発時に毎回外で走るのは大変なので、ダミーモードを必ず用意する。

```ts
const DEV_MOCK_RUN = true
```

ダミー仕様:

- 1秒ごとに距離を 2.8m 追加
- 約 5'57"/km 相当
- 1kmごとにラップ表示
- 心拍は `-- bpm` のまま

将来的に心拍ダミーを入れるなら 130〜155 bpm の範囲でランダム変動。

---

## 15. G2表示の注意

- 表示は詰め込みすぎない
- 1画面に多くても4〜5行
- 走行中は視認性優先
- 更新頻度は1秒で十分
- ラップ画面やメッセージ画面は自動で通常HUDへ戻す
- バッテリー消費を抑える
- アプリが落ちた時の復帰処理を入れる

---

## 16. 画面状態

```ts
type ScreenMode =
  | 'idle'
  | 'gps-waiting'
  | 'running'
  | 'paused'
  | 'lap'
  | 'message'
  | 'error'
```

---

## 17. エラー表示

### GPS未許可

```txt
GPS ERROR

位置情報を
許可してください
```

### GPS精度不足

```txt
GPS SEARCHING

空が見える場所へ
移動してください
```

### G2接続エラー

```txt
G2 ERROR

接続を確認
してください
```

---

## 18. 将来拡張

### Phase 2: Apple Watch / 心拍数

将来的に以下を追加する。

```txt
Apple Watch App
  ↓ HealthKit / HKWorkoutSession
iPhone App
  ↓ WatchConnectivity
Even Hub Plugin
  ↓
G2
```

必要要素:

- watchOSアプリ
- iOSコンパニオンアプリ
- HealthKit権限
- HKWorkoutSession
- WatchConnectivity
- 心拍数のリアルタイム送信

参考:

- https://developer.apple.com/documentation/healthkit/running-workout-sessions
- https://developer.apple.com/documentation/watchconnectivity

### Phase 3: マップ / ナビ

G2には高精細地図より簡易ナビが向いている。

```txt
← 200m先 左折
直進 600m
残り 1.2km
```

または簡易矢印画像・ピクトグラム表示。

### Phase 4: ランニングログ

- 距離
- 時間
- ペース
- ラップ
- メッセージ履歴

保存先候補:

- LocalStorage
- IndexedDB
- 外部API
- Notion
- Google Sheets
- Strava API

---

## 19. Codexへの依頼プロンプト例

以下を Codex に渡して実装を開始する。

```txt
Even Realities G2 向けの Even Hub プラグインとして、ランニングHUDのMVPを作成してください。

要件:
- TypeScript + Vite 構成
- Even Hub 公式テンプレートをベースにする
- G2に距離・平均ペース・経過時間・心拍数プレースホルダーを表示
- 心拍数は今回は未実装で `HR -- bpm`
- iPhoneの Geolocation API で距離を計測
- Haversine formula で距離を算出
- Start / Pause / Reset を実装
- 1kmごとにラップ画面を5〜8秒表示
- ラップ時にランダムメッセージを表示
- 開発用にGPSなしで動くダミーランモードを実装
- 表示処理は `src/even/render.ts`
- ランニング計測ロジックは `src/run/` 以下に分割
- まずは動作するMVPを優先し、Apple Watch / HealthKit / WatchConnectivity は実装しない

G2表示例:
RUN

3.24 km
5'42"/km
18:31
HR -- bpm

ラップ表示例:
LAP 3

1km 5'39"
AVG 5'44"
Nice pace!
```

---

## 20. 完了条件

MVP完了条件:

- Even Hubプラグインとして起動できる
- G2にHUDが表示される
- Start / Pause / Reset ができる
- ダミーモードで距離・ペース・時間が更新される
- 実GPSモードで距離が加算される
- 1km到達でラップ画面が出る
- ランダムメッセージが出る
- 心拍数は `-- bpm` で表示される
- 実機ランニング前に徒歩テストで表示崩れがない

---

## 21. 最初に確認すべきこと

Codexで実装を始める前に、以下を確認する。

1. Even Hub CLI / SDK の最新バージョン
2. 公式テンプレートの起動方法
3. 実機G2へのデプロイ/プレビュー方法
4. `EvenAppBridge` の利用方法
5. テキスト表示更新API
6. 入力イベント名
7. iOS WebView内で Geolocation API が許可されるか
8. スマホ画面ロック中・バックグラウンド時の挙動

---

## 22. 注意メモ

現時点では、ランニング中にスマホをロックした状態でEven HubプラグインとGPS更新が安定するかは未確認。  
まずは画面を開いた状態・プラグイン起動状態でテストする。

本格的な実用化では、Even Hubプラグインだけで完結するより、iOSネイティブアプリ + Even Hub 表示連携が必要になる可能性がある。
